/**
 * Nexus OS — Sub-Agent Manager
 * Advanced agent spawning system inspired by OpenClaw
 * Supports isolated agent sessions with lifecycle management
 */
import { logger } from '../logger.js';
import { eventBus } from '../events/eventBus.js';
import { getSupabase } from '../storage/supabaseClient.js';
import { llmRouter } from '../llm/LLMRouter.js';
import { randomUUID } from 'crypto';
import type { ToolCall } from '../tools/toolExecutor.js';

export interface ToolResult {
  toolCallId?: string;
  status: 'success' | 'error';
  output?: string;
  error?: string;
  data?: any;
}

export type SubAgentStatus = 'spawning' | 'running' | 'paused' | 'completed' | 'failed' | 'orphaned';
export type SubAgentMode = 'embedded' | 'harness' | 'sandbox';

export interface SubAgentConfig {
  id: string;
  parentSessionId?: string;
  name: string;
  description: string;
  mode: SubAgentMode;
  model: string;
  systemPrompt?: string;
  skills: string[];
  tools: string[];
  workspaceRoot?: string;
  sandboxConfig?: {
    image?: string;
    mounts?: string[];
    envVars?: Record<string, string>;
    networkEnabled?: boolean;
  };
  depth: number;
  maxDepth: number;
  requesterOrigin?: string;
  metadata?: Record<string, any>;
}

export interface SubAgentSession {
  id: string;
  config: SubAgentConfig;
  status: SubAgentStatus;
  spawnedAt: Date;
  completedAt?: Date;
  parentSessionId?: string;
  childSessionIds: string[];
  context: {
    messages: AgentMessage[];
    toolResults: ToolResult[];
    variables: Record<string, any>;
  };
  output?: string;
  error?: string;
  exitCode?: number;
}

export interface AgentMessage {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  attachments?: any[];
}

export interface SpawnRequest {
  name: string;
  description: string;
  message: string;
  mode?: SubAgentMode;
  model?: string;
  skills?: string[];
  workspaceRoot?: string;
  parentSessionId?: string;
  maxDepth?: number;
  timeout?: number;
}

export interface SpawnResult {
  sessionId: string;
  status: SubAgentStatus;
  output?: string;
  error?: string;
  childSessions?: string[];
}

class SubAgentManager {
  private sessions: Map<string, SubAgentSession> = new Map();
  private readonly DEFAULT_MAX_DEPTH = 3;
  private orphanCheckInterval?: NodeJS.Timeout;

  async initialize() {
    logger.info('[SubAgentManager] Initializing sub-agent system...');
    
    // Load existing sessions from database
    await this.loadSessions();
    
    // Start orphan recovery
    this.orphanCheckInterval = setInterval(() => {
      this.recoverOrphans();
    }, 30000);

    // Subscribe to events
    eventBus.subscribe('subagent_request', this.handleSpawnRequest.bind(this));
    eventBus.subscribe('subagent_completed', this.handleSubAgentCompleted.bind(this));

    logger.info('[SubAgentManager] Sub-agent system ready');
  }

  async spawn(request: SpawnRequest): Promise<SpawnResult> {
    const sessionId = randomUUID();
    const parentSession = request.parentSessionId 
      ? this.sessions.get(request.parentSessionId) 
      : undefined;

    // Check depth limits
    const currentDepth = parentSession ? parentSession.config.depth + 1 : 0;
    const maxDepth = request.maxDepth || this.DEFAULT_MAX_DEPTH;
    
    if (currentDepth > maxDepth) {
      throw new Error(`Sub-agent depth limit exceeded (${currentDepth}/${maxDepth})`);
    }

    const config: SubAgentConfig = {
      id: sessionId,
      parentSessionId: request.parentSessionId,
      name: request.name,
      description: request.description,
      mode: request.mode || 'embedded',
      model: request.model || process.env.DEFAULT_AGENT_MODEL || 'llama-3.3-70b',
      skills: request.skills || [],
      tools: [],
      workspaceRoot: request.workspaceRoot,
      depth: currentDepth,
      maxDepth,
      requesterOrigin: parentSession?.config.requesterOrigin || 'direct',
    };

    const session: SubAgentSession = {
      id: sessionId,
      config,
      status: 'spawning',
      spawnedAt: new Date(),
      parentSessionId: request.parentSessionId,
      childSessionIds: [],
      context: {
        messages: [],
        toolResults: [],
        variables: {}
      }
    };

    this.sessions.set(sessionId, session);

    // Add to parent's children if exists
    if (parentSession) {
      parentSession.childSessionIds.push(sessionId);
    }

    // Store in database
    await this.persistSession(session);

    // Announce spawn
    await this.announceSpawn(session);

    // Start execution
    this.executeSession(session, request.message).catch(err => {
      logger.error({ err, sessionId }, '[SubAgentManager] Session execution failed');
      this.failSession(sessionId, err.message);
    });

    return {
      sessionId,
      status: 'spawning'
    };
  }

  private async executeSession(session: SubAgentSession, initialMessage: string) {
    session.status = 'running';
    await this.persistSession(session);

    try {
      // Initialize system prompt
      const systemPrompt = this.buildSystemPrompt(session.config);
      session.context.messages.push({
        id: randomUUID(),
        role: 'system',
        content: systemPrompt,
        timestamp: new Date()
      });

      // Add initial user message
      session.context.messages.push({
        id: randomUUID(),
        role: 'user',
        content: initialMessage,
        timestamp: new Date()
      });

      // Run agent loop
      let iteration = 0;
      const maxIterations = 50;

      while (iteration < maxIterations && session.status === 'running') {
        iteration++;

        // Get LLM response
        const response = await this.callLLM(session);
        
        if (response.content) {
          session.context.messages.push({
            id: randomUUID(),
            role: 'assistant',
            content: response.content,
            timestamp: new Date(),
            toolCalls: response.toolCalls
          });
        }

        // Execute tool calls if any
        if (response.toolCalls && response.toolCalls.length > 0) {
          for (const toolCall of response.toolCalls) {
            const result = await this.executeToolCall(session, toolCall);
            session.context.toolResults.push(result);
            session.context.messages.push({
              id: randomUUID(),
              role: 'tool',
              content: JSON.stringify(result),
              timestamp: new Date(),
              toolResults: [result]
            });
          }
        } else {
          // No more tool calls, agent is done
          break;
        }

        // Compact context if needed
        if (this.shouldCompact(session)) {
          await this.compactSession(session);
        }
      }

      // Complete session
      const finalMessage = session.context.messages[session.context.messages.length - 1];
      session.output = finalMessage?.content || '';
      session.status = 'completed';
      session.completedAt = new Date();

    } catch (err) {
      session.status = 'failed';
      session.error = (err as Error).message;
    }

    await this.persistSession(session);
    await this.announceCompletion(session);
  }

  private async callLLM(session: SubAgentSession): Promise<{ content?: string; toolCalls?: ToolCall[] }> {
    const messages = session.context.messages.map(m => ({
      role: m.role,
      content: m.content
    }));

    // Convert messages to simple system/user format for existing LLMRouter
    const systemMsg = messages.find(m => m.role === 'system')?.content || '';
    const userMessages = messages.filter(m => m.role !== 'system').map(m => {
      if (m.role === 'assistant') return `Assistant: ${m.content}`;
      if (m.role === 'tool') return `Tool Result: ${m.content}`;
      return m.content;
    }).join('\n\n');

    const response = await llmRouter.call({
      system: systemMsg,
      user: userMessages,
      model: session.config.model,
      temperature: 0.7
    });

    // Parse tool calls from content if present (simple heuristic)
    const content = response.content || '';
    const toolCalls: ToolCall[] = [];
    
    // Look for tool call patterns in the content
    const toolCallMatch = content.match(/\{\s*"action"\s*:\s*"([^"]+)"\s*,\s*"parameters"\s*:\s*(\{[^}]*\})/);
    if (toolCallMatch) {
      toolCalls.push({
        toolName: toolCallMatch[1],
        arguments: JSON.parse(toolCallMatch[2]),
        missionId: session.id,
        taskId: session.id,
        userId: 'system'
      });
    }

    return {
      content: content.replace(/\{\s*"action".*?\}/s, '').trim(),
      toolCalls
    };
  }

  private async executeToolCall(session: SubAgentSession, toolCall: ToolCall): Promise<ToolResult> {
    // Check if this is a subagent spawn tool
    if (toolCall.toolName === 'spawn_subagent') {
      const args = typeof toolCall.arguments === 'string' 
        ? JSON.parse(toolCall.arguments) 
        : toolCall.arguments;
      
      const result = await this.spawn({
        name: args.name,
        description: args.description,
        message: args.message,
        parentSessionId: session.id,
        mode: args.mode,
        maxDepth: session.config.maxDepth
      });

      return {
        toolCallId: toolCall.id,
        status: 'success',
        output: `Spawned sub-agent: ${result.sessionId}`,
        data: result
      };
    }

    // Execute via tool executor
    const { toolExecutor } = await import('../tools/toolExecutor.js');
    return toolExecutor.execute(toolCall, {
      workspaceRoot: session.config.workspaceRoot,
      sessionId: session.id
    });
  }

  private buildSystemPrompt(config: SubAgentConfig): string {
    let prompt = `You are "${config.name}", an AI sub-agent.\n\n`;
    prompt += `Description: ${config.description}\n\n`;
    
    if (config.depth > 0) {
      prompt += `You are operating at depth ${config.depth} in a sub-agent hierarchy. `;
      prompt += `You can spawn additional sub-agents if needed, up to depth ${config.maxDepth}.\n\n`;
    }

    if (config.skills.length > 0) {
      prompt += `Available skills: ${config.skills.join(', ')}\n\n`;
    }

    if (config.systemPrompt) {
      prompt += `\n${config.systemPrompt}`;
    }

    prompt += `\n\nWhen you need to perform complex tasks, use the spawn_subagent tool to create specialized sub-agents.`;
    prompt += `\nWhen finished, provide a clear summary of your work.`;

    return prompt;
  }

  private async getAvailableTools(session: SubAgentSession): Promise<any[]> {
    const tools: any[] = [];

    // Add subagent spawn tool if depth allows
    if (session.config.depth < session.config.maxDepth) {
      tools.push({
        type: 'function',
        function: {
          name: 'spawn_subagent',
          description: 'Spawn a new sub-agent to handle a specific task',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Name for the sub-agent' },
              description: { type: 'string', description: 'Description of the task' },
              message: { type: 'string', description: 'The task message for the sub-agent' },
              mode: { type: 'string', enum: ['embedded', 'harness', 'sandbox'] }
            },
            required: ['name', 'description', 'message']
          }
        }
      });
    }

    // Add configured tools
    const { skillRuntime } = await import('../tools/skillRuntime.js');
    const skillTools = await skillRuntime.getToolsForSkills(session.config.skills);
    tools.push(...skillTools);

    return tools;
  }

  private shouldCompact(session: SubAgentSession): boolean {
    const messageCount = session.context.messages.length;
    const estimatedTokens = messageCount * 150; // Rough estimate
    return estimatedTokens > 8000;
  }

  private async compactSession(session: SubAgentSession) {
    logger.info(`[SubAgentManager] Compacting session ${session.id}`);
    
    // Summarize older messages
    const messagesToSummarize = session.context.messages.slice(2, -4);
    const summary = await this.summarizeMessages(messagesToSummarize);
    
    // Replace with summary
    session.context.messages = [
      session.context.messages[0], // System prompt
      {
        id: randomUUID(),
        role: 'system',
        content: `Previous conversation summary: ${summary}`,
        timestamp: new Date()
      },
      ...session.context.messages.slice(-4) // Keep last 4 messages
    ];
  }

  private async summarizeMessages(messages: AgentMessage[]): Promise<string> {
    const content = messages.map(m => `${m.role}: ${m.content}`).join('\n\n');
    
    const response = await llmRouter.call({
      system: 'Summarize the following conversation concisely, preserving key facts and decisions.',
      user: content,
      model: 'llama-3.3-70b'
    });

    return response.content || 'Conversation summarized';
  }

  async steer(sessionId: string, action: 'pause' | 'resume' | 'cancel'): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    switch (action) {
      case 'pause':
        session.status = 'paused';
        break;
      case 'resume':
        if (session.status === 'paused') {
          session.status = 'running';
        }
        break;
      case 'cancel':
        session.status = 'failed';
        session.error = 'Cancelled by user';
        break;
    }

    await this.persistSession(session);
  }

  async getSession(sessionId: string): Promise<SubAgentSession | undefined> {
    return this.sessions.get(sessionId);
  }

  async listSessions(filter?: { 
    parentSessionId?: string; 
    status?: SubAgentStatus;
    workspaceId?: string;
  }): Promise<SubAgentSession[]> {
    let sessions = Array.from(this.sessions.values());

    if (filter?.parentSessionId) {
      sessions = sessions.filter(s => s.parentSessionId === filter.parentSessionId);
    }
    if (filter?.status) {
      sessions = sessions.filter(s => s.status === filter.status);
    }

    return sessions;
  }

  private async loadSessions() {
    const supabase = await getSupabase();
    const { data: sessions } = await supabase
      .from('subagent_sessions')
      .select('*')
      .in('status', ['running', 'paused']);

    for (const data of sessions || []) {
      const session = this.deserializeSession(data);
      this.sessions.set(session.id, session);
    }
  }

  private async persistSession(session: SubAgentSession) {
    const supabase = await getSupabase();
    await supabase
      .from('subagent_sessions')
      .upsert({
        id: session.id,
        config: session.config,
        status: session.status,
        parent_session_id: session.parentSessionId,
        child_session_ids: session.childSessionIds,
        context: session.context,
        output: session.output,
        error: session.error,
        spawned_at: session.spawnedAt.toISOString(),
        completed_at: session.completedAt?.toISOString()
      });
  }

  private deserializeSession(data: any): SubAgentSession {
    return {
      id: data.id,
      config: data.config,
      status: data.status,
      spawnedAt: new Date(data.spawned_at),
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
      parentSessionId: data.parent_session_id,
      childSessionIds: data.child_session_ids || [],
      context: data.context || { messages: [], toolResults: [], variables: {} },
      output: data.output,
      error: data.error
    };
  }

  private async failSession(sessionId: string, error: string) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'failed';
      session.error = error;
      session.completedAt = new Date();
      await this.persistSession(session);
      await this.announceCompletion(session);
    }
  }

  private async recoverOrphans() {
    const orphans = await this.listSessions({ status: 'running' });
    const now = Date.now();

    for (const session of orphans) {
      const age = now - session.spawnedAt.getTime();
      if (age > 300000) { // 5 minutes
        logger.warn(`[SubAgentManager] Orphaned session detected: ${session.id}`);
        session.status = 'orphaned';
        await this.persistSession(session);
      }
    }
  }

  private async announceSpawn(session: SubAgentSession) {
    await eventBus.publish('subagent_spawned', {
      type: 'subagent_spawned',
      sessionId: session.id,
      parentSessionId: session.parentSessionId,
      name: session.config.name,
      depth: session.config.depth,
      timestamp: Date.now()
    });
  }

  private async announceCompletion(session: SubAgentSession) {
    await eventBus.publish('subagent_completed', {
      type: 'subagent_completed',
      sessionId: session.id,
      parentSessionId: session.parentSessionId,
      status: session.status,
      output: session.output,
      error: session.error,
      timestamp: Date.now()
    });

    // Notify parent if exists
    if (session.parentSessionId) {
      const parent = this.sessions.get(session.parentSessionId);
      if (parent && parent.status === 'running') {
        parent.context.messages.push({
          id: randomUUID(),
          role: 'user',
          content: `Sub-agent "${session.config.name}" completed with status: ${session.status}\n\nOutput: ${session.output || 'No output'}`,
          timestamp: new Date()
        });
      }
    }
  }

  private async handleSpawnRequest(event: any) {
    const { request } = event;
    try {
      await this.spawn(request);
    } catch (err) {
      logger.error({ err }, '[SubAgentManager] Failed to handle spawn request');
    }
  }

  private async handleSubAgentCompleted(event: any) {
    logger.info(`[SubAgentManager] Sub-agent ${event.sessionId} completed: ${event.status}`);
  }
}

export const subAgentManager = new SubAgentManager();
