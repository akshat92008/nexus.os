/**
 * Nexus OS — Hybrid Bridge (Local-to-Cloud Tunnel)
 *
 * Upgraded with an OpenClaw-inspired gateway handshake and method policy:
 * - typed WS frames
 * - connect.challenge / connect / hello-ok handshake
 * - method scope enforcement on node.invoke
 *
 * This keeps Nexus's differentiator intact:
 * the bridge is just the Nerve transport. DAG orchestration, saga rollback,
 * and HITL approval remain in Nexus-owned services above it.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../logger.js';
import {
  authorizeOperatorScopesForMethod,
  NEXUS_DEFAULT_OPERATOR_SCOPES,
} from './NerveMethodPolicy.js';
import {
  buildConnectChallenge,
  buildErrorResponse,
  buildHelloOk,
  isGatewayEventFrame,
  isGatewayRequestFrame,
  parseGatewayFrame,
  validateConnectParams,
  type ConnectedNerveClient,
  type GatewayConnectParams,
} from './NerveGatewayProtocol.js';

export interface LocalTaskRequest {
  id: string;
  tool_id: string;
  params: any;
  mission_id: string;
}

export interface LocalTaskResponse {
  id: string;
  status: 'success' | 'error';
  data?: any;
  error?: string;
}

interface PendingConnection {
  challengeNonce: string;
  clientId: string;
  authenticated: boolean;
}

interface ConnectedClientState {
  socket: WebSocket;
  metadata: ConnectedNerveClient;
}

function sendFrame(ws: WebSocket, frame: unknown) {
  ws.send(JSON.stringify(frame));
}

function coerceLocalTaskResponse(frame: unknown): LocalTaskResponse | null {
  if (!frame || typeof frame !== 'object') return null;

  const raw = frame as any;

  if (typeof raw.id === 'string' && (raw.status === 'success' || raw.status === 'error')) {
    return raw as LocalTaskResponse;
  }

  if (
    raw.type === 'event' &&
    raw.event === 'node.invoke.result' &&
    raw.payload &&
    typeof raw.payload.requestId === 'string'
  ) {
    return {
      id: raw.payload.requestId,
      status: raw.payload.status === 'error' ? 'error' : 'success',
      data: raw.payload.data,
      error: raw.payload.error,
    };
  }

  if (raw.type === 'res' && typeof raw.id === 'string') {
    return {
      id: raw.id,
      status: raw.ok ? 'success' : 'error',
      data: raw.payload,
      error: raw.error?.message,
    };
  }

  return null;
}

class HybridBridge {
  private wss: WebSocketServer | null = null;
  private started = false;
  private requiredToken = process.env.NEXUS_NERVE_TOKEN || process.env.SUPABASE_SERVICE_KEY || '';
  private localClients: Map<string, ConnectedClientState> = new Map();
  private pendingConnections: Map<WebSocket, PendingConnection> = new Map();
  private pendingTasks: Map<string, (res: LocalTaskResponse) => void> = new Map();

  /**
   * Initializes the bridge listener (on the Cloud Brain side).
   */
  start(port: number = 3007) {
    if (this.started) return;

    logger.info({ port }, '[HybridBridge] Starting Nerve Tunnel Listener');
    if (!this.requiredToken) {
      logger.warn(
        '[HybridBridge] No NEXUS_NERVE_TOKEN configured. Falling back to local-trust mode for node handshakes.'
      );
    }
    this.wss = new WebSocketServer({ port });
    this.started = true;

    this.wss.on('connection', (ws) => {
      const clientId = uuidv4();
      const challenge = buildConnectChallenge();
      const nonce = (challenge.payload as any)?.nonce as string;

      logger.info({ clientId }, '[HybridBridge] Incoming local Nerve connection');
      this.pendingConnections.set(ws, {
        challengeNonce: nonce,
        clientId,
        authenticated: false,
      });
      sendFrame(ws, challenge);

      ws.on('message', (data) => {
        try {
          this.handleSocketMessage(ws, data.toString());
        } catch (err: any) {
          logger.error({ err: err.message }, '[HybridBridge] Failed to handle socket message');
        }
      });

      ws.on('close', () => {
        const pending = this.pendingConnections.get(ws);
        if (pending) {
          logger.info({ clientId: pending.clientId }, '[HybridBridge] Pending Nerve connection closed');
          this.pendingConnections.delete(ws);
        }

        for (const [clientIdKey, client] of this.localClients.entries()) {
          if (client.socket === ws) {
            logger.info({ clientId: clientIdKey }, '[HybridBridge] Authenticated Nerve client disconnected');
            this.localClients.delete(clientIdKey);
          }
        }
      });
    });
  }

  private handleSocketMessage(ws: WebSocket, raw: string) {
    const frame = parseGatewayFrame(raw);

    if (!frame) {
      logger.warn('[HybridBridge] Ignoring malformed socket frame');
      return;
    }

    const pending = this.pendingConnections.get(ws);
    if (pending && !pending.authenticated) {
      this.handleHandshakeFrame(ws, pending, frame);
      return;
    }

    const response = coerceLocalTaskResponse(frame);
    if (response) {
      const handler = this.pendingTasks.get(response.id);
      if (handler) {
        handler(response);
        this.pendingTasks.delete(response.id);
      }
      return;
    }

    if (isGatewayEventFrame(frame) && frame.event === 'node.event') {
      logger.info({ payload: frame.payload }, '[HybridBridge] Received node.event');
      return;
    }

    logger.warn({ frame }, '[HybridBridge] Unrecognized authenticated bridge frame');
  }

  private handleHandshakeFrame(
    ws: WebSocket,
    pending: PendingConnection,
    frame: unknown
  ) {
    if (!isGatewayRequestFrame(frame) || frame.method !== 'connect') {
      ws.close(1008, 'connect required');
      return;
    }

    const validation = validateConnectParams(
      (frame.params || {}) as GatewayConnectParams,
      pending.challengeNonce,
      this.requiredToken || undefined
    );

    if (!validation.ok) {
      sendFrame(ws, buildErrorResponse(frame.id, validation.code, validation.message));
      ws.close(1008, validation.message);
      return;
    }

    pending.authenticated = true;
    this.pendingConnections.delete(ws);
    this.localClients.set(pending.clientId, {
      socket: ws,
      metadata: validation.client,
    });

    logger.info(
      {
        clientId: pending.clientId,
        caps: validation.client.caps,
        commands: validation.client.commands,
      },
      '[HybridBridge] Local Nerve client authenticated'
    );

    sendFrame(
      ws,
      buildHelloOk({
        requestId: frame.id,
        connId: pending.clientId,
        scopes: NEXUS_DEFAULT_OPERATOR_SCOPES,
      })
    );
  }

  private selectLocalClient(toolId: string): [string, ConnectedClientState] | undefined {
    const clients = Array.from(this.localClients.entries());
    return (
      clients.find(([, client]) => client.metadata.commands.includes(toolId)) ||
      clients.find(([, client]) => client.metadata.commands.length === 0) ||
      clients[0]
    );
  }

  /**
   * Routes a task to a local Nerve Agent.
   */
  async executeLocally(missionId: string, toolId: string, params: any): Promise<any> {
    if (this.localClients.size === 0) {
      throw new Error('[HybridBridge] No local Nerve Agents connected. Cannot access local files.');
    }

    const authorization = authorizeOperatorScopesForMethod('node.invoke', NEXUS_DEFAULT_OPERATOR_SCOPES);
    if (!authorization.allowed) {
      throw new Error(`[HybridBridge] Bridge operator is missing ${authorization.missingScope}`);
    }

    const target = this.selectLocalClient(toolId);
    if (!target) {
      throw new Error(`[HybridBridge] No local Nerve Agent can handle ${toolId}`);
    }

    const [clientId, client] = target;
    const taskId = uuidv4();
    const request: LocalTaskRequest = {
      id: taskId,
      tool_id: toolId,
      params,
      mission_id: missionId,
    };

    logger.info({ clientId, toolId, missionId }, '[HybridBridge] Routing task to local Nerve client');

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingTasks.delete(taskId);
        reject(new Error(`[HybridBridge] Task ${toolId} timed out after 30s`));
      }, 30000);

      this.pendingTasks.set(taskId, (res) => {
        clearTimeout(timeout);
        if (res.status === 'success') resolve(res.data);
        else reject(new Error(res.error || 'Unknown local execution error'));
      });

      sendFrame(client.socket, {
        type: 'event',
        event: 'node.invoke.request',
        payload: {
          requestId: taskId,
          method: 'node.invoke',
          missionId,
          toolId,
          params,
        },
      });
    });
  }

  getStatus() {
    return {
      started: this.started,
      connectedClients: Array.from(this.localClients.entries()).map(([id, client]) => ({
        id,
        role: client.metadata.role,
        caps: client.metadata.caps,
        commands: client.metadata.commands,
        connectedAt: client.metadata.connectedAt,
        client: client.metadata.client,
      })),
    };
  }

  get isUp() {
    return this.localClients.size > 0;
  }
}

export const hybridBridge = new HybridBridge();
