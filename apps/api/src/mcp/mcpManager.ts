/**
 * Nexus OS — MCP (Model Context Protocol) Manager
 * Bridge for external MCP servers, similar to OpenClaw's mcporter approach
 */
import { logger } from '../logger.js';
import { eventBus } from '../events/eventBus.js';
import { getSupabase } from '../storage/supabaseClient.js';
import { randomUUID } from 'crypto';
import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

export type MCPServerType = 'stdio' | 'sse' | 'streamable-http';

export interface MCPServerConfig {
  id: string;
  name: string;
  type: MCPServerType;
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  cwd?: string;
  timeout?: number;
  capabilities?: {
    tools?: boolean;
    resources?: boolean;
    prompts?: boolean;
    logging?: boolean;
  };
  auth?: {
    type: 'bearer' | 'api-key';
    token?: string;
    apiKey?: string;
  };
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
  serverId: string;
}

export interface MCPResource {
  uri: string;
  name: string;
  mimeType?: string;
  description?: string;
  serverId: string;
}

export interface MCPConnection {
  id: string;
  config: MCPServerConfig;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  process?: ChildProcess;
  tools: MCPTool[];
  resources: MCPResource[];
  lastError?: string;
  connectedAt?: Date;
  messageCount: number;
}

export interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface MCPNotification {
  jsonrpc: '2.0';
  method: string;
  params?: any;
}

class MCPManager {
  private connections: Map<string, MCPConnection> = new Map();
  private pendingRequests: Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }> = new Map();
  private requestId = 1;
  private requestTimeout = 30000;

  async initialize() {
    logger.info('[MCPManager] Initializing MCP bridge...');
    
    // Load configured MCP servers
    await this.loadConfiguredServers();
    
    logger.info(`[MCPManager] Loaded ${this.connections.size} MCP servers`);
  }

  async loadConfiguredServers() {
    const supabase = await getSupabase();
    const { data: configs, error } = await supabase
      .from('mcp_servers')
      .select('*')
      .eq('is_active', true);

    if (error) {
      logger.error({ err: error }, '[MCPManager] Failed to load servers');
      return;
    }

    for (const data of configs || []) {
      const config: MCPServerConfig = {
        id: data.id,
        name: data.name,
        type: data.type,
        command: data.command,
        args: data.args || [],
        url: data.url,
        env: data.env || {},
        cwd: data.cwd,
        timeout: data.timeout || 30000,
        capabilities: data.capabilities || { tools: true }
      };

      await this.connectServer(config).catch(err => {
        logger.error({ err, serverId: config.id }, '[MCPManager] Failed to connect server');
      });
    }
  }

  async connectServer(config: MCPServerConfig): Promise<MCPConnection> {
    const id = config.id || randomUUID();
    
    const connection: MCPConnection = {
      id,
      config,
      status: 'connecting',
      tools: [],
      resources: [],
      messageCount: 0
    };

    this.connections.set(id, connection);

    if (config.type === 'stdio') {
      await this.connectStdio(connection);
    } else if (config.type === 'sse' || config.type === 'streamable-http') {
      await this.connectHttp(connection);
    }

    // Initialize MCP session
    await this.initializeSession(connection);

    connection.status = 'connected';
    connection.connectedAt = new Date();

    logger.info(`[MCPManager] Connected MCP server: ${config.name} (${id})`);

    return connection;
  }

  private async connectStdio(connection: MCPConnection) {
    const { config } = connection;
    
    if (!config.command) {
      throw new Error('Command required for stdio MCP server');
    }

    const proc = spawn(config.command, config.args || [], {
      env: { ...process.env, ...config.env },
      cwd: config.cwd,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    connection.process = proc;

    // Handle stdout
    proc.stdout?.on('data', (data: Buffer) => {
      this.handleServerMessage(connection, data.toString());
    });

    // Handle stderr
    proc.stderr?.on('data', (data: Buffer) => {
      logger.warn(`[MCP:${connection.config.name}] ${data.toString()}`);
    });

    // Handle process exit
    proc.on('exit', (code) => {
      logger.info(`[MCP:${connection.config.name}] Process exited with code ${code}`);
      connection.status = 'disconnected';
      this.connections.delete(connection.id);
    });

    // Handle errors
    proc.on('error', (err) => {
      logger.error({ err }, `[MCP:${connection.config.name}] Process error`);
      connection.status = 'error';
      connection.lastError = err.message;
    });
  }

  private async connectHttp(connection: MCPConnection) {
    // For SSE/HTTP servers, we'd establish a connection
    // This is simplified - real implementation would use fetch/EventSource
    logger.info(`[MCPManager] HTTP connection type not fully implemented yet`);
    connection.status = 'connected';
  }

  private async initializeSession(connection: MCPConnection) {
    // Send initialize request
    const result = await this.sendRequest(connection, {
      jsonrpc: '2.0',
      id: this.nextRequestId(),
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: { listChanged: true },
          resources: { listChanged: true, subscribe: true }
        },
        clientInfo: {
          name: 'nexus-os',
          version: '1.0.0'
        }
      }
    });

    // Send initialized notification
    await this.sendNotification(connection, {
      jsonrpc: '2.0',
      method: 'notifications/initialized'
    });

    // Fetch tools if supported
    if (connection.config.capabilities?.tools !== false) {
      await this.fetchTools(connection);
    }

    // Fetch resources if supported
    if (connection.config.capabilities?.resources) {
      await this.fetchResources(connection);
    }
  }

  private async fetchTools(connection: MCPConnection) {
    try {
      const result = await this.sendRequest(connection, {
        jsonrpc: '2.0',
        id: this.nextRequestId(),
        method: 'tools/list'
      });

      if (result.tools) {
        connection.tools = result.tools.map((t: any) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
          serverId: connection.id
        }));

        logger.info(`[MCP:${connection.config.name}] Loaded ${connection.tools.length} tools`);
      }
    } catch (err) {
      logger.warn(`[MCP:${connection.config.name}] Failed to fetch tools: ${err}`);
    }
  }

  private async fetchResources(connection: MCPConnection) {
    try {
      const result = await this.sendRequest(connection, {
        jsonrpc: '2.0',
        id: this.nextRequestId(),
        method: 'resources/list'
      });

      if (result.resources) {
        connection.resources = result.resources.map((r: any) => ({
          uri: r.uri,
          name: r.name,
          mimeType: r.mimeType,
          description: r.description,
          serverId: connection.id
        }));

        logger.info(`[MCP:${connection.config.name}] Loaded ${connection.resources.length} resources`);
      }
    } catch (err) {
      logger.warn(`[MCP:${connection.config.name}] Failed to fetch resources: ${err}`);
    }
  }

  private handleServerMessage(connection: MCPConnection, data: string) {
    // Handle line-delimited JSON (stdio transport)
    const lines = data.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      try {
        const message = JSON.parse(line);
        
        if ('id' in message) {
          // Response
          const pending = this.pendingRequests.get(String(message.id));
          if (pending) {
            clearTimeout(pending.timeout);
            this.pendingRequests.delete(String(message.id));
            
            if (message.error) {
              pending.reject(new Error(message.error.message));
            } else {
              pending.resolve(message.result);
            }
          }
        } else {
          // Notification
          this.handleNotification(connection, message);
        }
        
        connection.messageCount++;
      } catch (err) {
        logger.warn(`[MCP:${connection.config.name}] Failed to parse message: ${line}`);
      }
    }
  }

  private handleNotification(connection: MCPConnection, notification: MCPNotification) {
    switch (notification.method) {
      case 'notifications/tools/list_changed':
        this.fetchTools(connection);
        break;
      case 'notifications/resources/list_changed':
        this.fetchResources(connection);
        break;
      case 'notifications/message':
        logger.info(`[MCP:${connection.config.name}] ${notification.params?.message}`);
        break;
    }
  }

  async sendRequest(connection: MCPConnection, request: MCPRequest): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(String(request.id));
        reject(new Error('MCP request timeout'));
      }, connection.config.timeout || this.requestTimeout);

      this.pendingRequests.set(String(request.id), { resolve, reject, timeout });

      if (connection.config.type === 'stdio' && connection.process) {
        const message = JSON.stringify(request) + '\n';
        connection.process.stdin?.write(message);
      } else if (connection.config.type === 'sse' || connection.config.type === 'streamable-http') {
        // HTTP-based requests
        this.sendHttpRequest(connection, request).then(resolve).catch(reject);
      }
    });
  }

  private async sendHttpRequest(connection: MCPConnection, request: MCPRequest): Promise<any> {
    const url = connection.config.url;
    if (!url) throw new Error('URL required for HTTP MCP connection');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    if (connection.config.auth?.type === 'bearer' && connection.config.auth.token) {
      headers['Authorization'] = `Bearer ${connection.config.auth.token}`;
    } else if (connection.config.auth?.type === 'api-key' && connection.config.auth.apiKey) {
      headers['X-API-Key'] = connection.config.auth.apiKey;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    return await response.json();
  }

  async sendNotification(connection: MCPConnection, notification: MCPNotification) {
    if (connection.config.type === 'stdio' && connection.process) {
      const message = JSON.stringify(notification) + '\n';
      connection.process.stdin?.write(message);
    }
  }

  async callTool(serverId: string, toolName: string, args: Record<string, any>): Promise<any> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      throw new Error(`MCP server ${serverId} not connected`);
    }

    const tool = connection.tools.find(t => t.name === toolName);
    if (!tool) {
      throw new Error(`Tool ${toolName} not found on server ${serverId}`);
    }

    const result = await this.sendRequest(connection, {
      jsonrpc: '2.0',
      id: this.nextRequestId(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    });

    return result;
  }

  async readResource(serverId: string, uri: string): Promise<any> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      throw new Error(`MCP server ${serverId} not connected`);
    }

    const result = await this.sendRequest(connection, {
      jsonrpc: '2.0',
      id: this.nextRequestId(),
      method: 'resources/read',
      params: { uri }
    });

    return result;
  }

  async disconnectServer(serverId: string) {
    const connection = this.connections.get(serverId);
    if (!connection) return;

    if (connection.process) {
      connection.process.kill();
    }

    connection.status = 'disconnected';
    this.connections.delete(serverId);

    logger.info(`[MCPManager] Disconnected MCP server: ${connection.config.name}`);
  }

  getAllTools(): MCPTool[] {
    const tools: MCPTool[] = [];
    for (const connection of this.connections.values()) {
      if (connection.status === 'connected') {
        tools.push(...connection.tools);
      }
    }
    return tools;
  }

  getAllResources(): MCPResource[] {
    const resources: MCPResource[] = [];
    for (const connection of this.connections.values()) {
      if (connection.status === 'connected') {
        resources.push(...connection.resources);
      }
    }
    return resources;
  }

  getConnection(serverId: string): MCPConnection | undefined {
    return this.connections.get(serverId);
  }

  getConnections(): MCPConnection[] {
    return Array.from(this.connections.values());
  }

  private nextRequestId(): number {
    return this.requestId++;
  }

  // Convert MCP tools to Nexus tool format
  toNexusTools(): Array<{ type: string; function: { name: string; description: string; parameters: any } }> {
    return this.getAllTools().map(tool => ({
      type: 'function' as const,
      function: {
        name: `mcp_${tool.serverId}_${tool.name}`,
        description: `[MCP:${tool.serverId}] ${tool.description}`,
        parameters: tool.inputSchema
      }
    }));
  }

  async executeNexusTool(toolName: string, args: Record<string, any>): Promise<any> {
    // Parse tool name: mcp_{serverId}_{toolName}
    const match = toolName.match(/^mcp_([^_]+)_(.+)$/);
    if (!match) {
      throw new Error(`Invalid MCP tool name format: ${toolName}`);
    }

    const [, serverId, actualToolName] = match;
    return this.callTool(serverId, actualToolName, args);
  }
}

export const mcpManager = new MCPManager();
