/**
 * Nexus OS — Matrix Channel Adapter (using matrix-js-sdk)
 */
import { type ChannelAdapter, type ChannelConfig, type ChannelMessage, channelManager } from '../channelManager.js';
import { logger } from '../../logger.js';
import { randomUUID } from 'crypto';

export class MatrixAdapter implements ChannelAdapter {
  private clients: Map<string, any> = new Map();

  async connect(config: ChannelConfig): Promise<void> {
    const { homeserverUrl, accessToken, userId } = config.credentials;
    
    if (!homeserverUrl || !accessToken) {
      logger.warn({ channelId: config.id }, '[MatrixAdapter] Missing Matrix credentials');
      return;
    }

    logger.info(`[MatrixAdapter] Connecting to ${homeserverUrl} as ${userId || 'bot'}`);

    // In production: use matrix-js-sdk
    // const sdk = await import('matrix-js-sdk');
    // const client = sdk.createClient({ baseUrl: homeserverUrl, accessToken, userId });
    // await client.startClient({ initialSyncLimit: 10 });
    // client.on('Room.timeline', (event, room) => { ... });

    this.clients.set(config.id, {
      config,
      connected: true,
      homeserver: homeserverUrl,        // ADD THIS
      accessToken: accessToken,          // ADD THIS
      matrixClient: null,               // populated by sdk if installed
    });

    logger.info(`[MatrixAdapter] Matrix client ready for ${config.name}`);
  }

  async disconnect(channelId: string): Promise<void> {
    const client = this.clients.get(channelId);
    if (client?.matrixClient?.stopClient) {
      client.matrixClient.stopClient();
    }
    this.clients.delete(channelId);
    logger.info(`[MatrixAdapter] Disconnected ${channelId}`);
  }

  async sendMessage(channelId: string, content: string, options?: {
    threadId?: string;
    replyTo?: string;
  }): Promise<any> {
    const client = this.clients.get(channelId);
    if (!client) return { error: 'Matrix not configured' };

    const roomId = options?.threadId;
    if (!roomId) return { error: 'Room ID (options.threadId) is required for Matrix' };

    try {
      // matrix-js-sdk: pnpm add matrix-js-sdk
      // If not installed, fall through to fetch-based fallback
      const sdk = await import('matrix-js-sdk').catch(() => null);

      if (sdk && client.matrixClient) {
        const result = await client.matrixClient.sendTextMessage(roomId, content);
        return { sent: true, eventId: result.event_id, roomId };
      }

      // Fetch-based fallback using Matrix CS API directly
      const { homeserver, accessToken } = client;
      if (!homeserver || !accessToken) {
        return { error: 'Matrix homeserver or accessToken missing' };
      }

      const txnId = `nexus-${Date.now()}`;
      const res = await fetch(
        `${homeserver}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${txnId}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ msgtype: 'm.text', body: content }),
        }
      );

      if (!res.ok) {
        const err = await res.text();
        return { error: `Matrix API error (${res.status}): ${err}` };
      }

      const data = await res.json() as any;
      logger.info(`[MatrixAdapter:${channelId}] Message sent to ${roomId}`);
      return { sent: true, eventId: data.event_id, roomId };
    } catch (err: any) {
      logger.error({ err: err.message }, `[MatrixAdapter:${channelId}] Send failed`);
      return { error: err.message };
    }
  }

  async getHistory?(channelId: string, limit?: number): Promise<ChannelMessage[]> {
    return [];
  }
}
