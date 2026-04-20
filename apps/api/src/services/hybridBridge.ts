/**
 * Nexus OS — Hybrid Bridge (Local-to-Cloud Tunnel)
 *
 * This service enables the "Cloud Brain" to execute "Local Hands" tasks.
 * When running in 'cloud' mode, this bridge connects to a secure local Nerve Agent.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';

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

class HybridBridge {
    private wss: WebSocketServer | null = null;
    private localClients: Map<string, WebSocket> = new Map();
    private pendingTasks: Map<string, (res: LocalTaskResponse) => void> = new Map();

    /**
     * Initializes the bridge listener (On the Cloud Brain side).
     */
    start(port: number = 3007) {
        console.log(`[HybridBridge] 🔌 Starting Nerve Tunnel Listener on port ${port}...`);
        this.wss = new WebSocketServer({ port });

        this.wss.on('connection', (ws) => {
            const clientId = uuidv4();
            console.log(`[HybridBridge] 🔗 Local Nerve Agent connected: ${clientId}`);
            this.localClients.set(clientId, ws);

            ws.on('message', (data) => {
                try {
                    const response = JSON.parse(data.toString()) as LocalTaskResponse;
                    const handler = this.pendingTasks.get(response.id);
                    if (handler) {
                        handler(response);
                        this.pendingTasks.delete(response.id);
                    }
                } catch (err) {
                    console.error('[HybridBridge] Error parsing local response:', err);
                }
            });

            ws.on('close', () => {
                console.log(`[HybridBridge] ❌ Local Nerve Agent disconnected: ${clientId}`);
                this.localClients.delete(clientId);
            });
        });
    }

    /**
     * Routes a task to a local Nerve Agent.
     */
    async executeLocally(missionId: string, toolId: string, params: any): Promise<any> {
        if (this.localClients.size === 0) {
            throw new Error('[HybridBridge] No local Nerve Agents connected. Cannot access local files.');
        }

        const taskId = uuidv4();
        const request: LocalTaskRequest = {
            id: taskId,
            tool_id: toolId,
            params,
            mission_id: missionId
        };

        // For the prototype, we send to the first available client
        const [clientId, ws] = Array.from(this.localClients.entries())[0];
        console.log(`[HybridBridge] 🚢 Routing task ${toolId} to client ${clientId}...`);

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

            ws.send(JSON.stringify(request));
        });
    }

    get isUp() {
        return this.localClients.size > 0;
    }
}

export const hybridBridge = new HybridBridge();
