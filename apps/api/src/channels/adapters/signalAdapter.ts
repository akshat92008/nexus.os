/**
 * Nexus OS — Signal Channel Adapter (stub for signald/libsignal-client)
 */
import { type ChannelAdapter, type ChannelConfig, type ChannelMessage, channelManager } from '../channelManager.js';
import { logger } from '../../logger.js';
import { randomUUID } from 'crypto';

export class SignalAdapter implements ChannelAdapter {
  private connections: Map<string, any> = new Map();

  async connect(config: ChannelConfig): Promise<void> {
    const { accountId, socketPath } = config.credentials;
    
    logger.info(`[SignalAdapter] Connecting to signald at ${socketPath || '/var/run/signald/signald.sock'} for ${config.name}`);
    
    // In production: connect to signald Unix socket or use libsignal-client
    // signald is a daemon that bridges Signal Protocol to JSON-RPC over Unix socket
    this.connections.set(config.id, {
      config,
      connected: true,
      account: accountId
    });

    logger.info(`[SignalAdapter] Signal connection ready for ${config.name}. Requires signald daemon.`);
  }

  async disconnect(channelId: string): Promise<void> {
    const conn = this.connections.get(channelId);
    if (conn?.ws) {
      conn.ws.close();
    }
    this.connections.delete(channelId);
    logger.info(`[SignalAdapter] Disconnected ${channelId}`);
  }

  async sendMessage(channelId: string, content: string, options?: {
    threadId?: string;
    attachments?: any[];
  }): Promise<any> {
    const conn = this.connections.get(channelId);
    if (!conn) return { error: 'Signal not configured' };

    const recipient = options?.threadId;
    if (!recipient) return { error: 'Recipient phone number (options.threadId) is required for Signal' };

    // Signal requires signald daemon: https://signald.org/articles/install/
    // Once installed, communicate via Unix socket JSON-RPC:
    //
    //   const net = await import('net');
    //   const socket = net.createConnection(conn.config.credentials.socketPath || '/var/run/signald/signald.sock');
    //   socket.write(JSON.stringify({
    //     type: 'send',
    //     username: conn.config.credentials.accountId,
    //     recipientAddress: { number: recipient },
    //     messageBody: content,
    //   }) + '\n');
    //
    // Without signald running, we cannot send. Return a clear error.

    const socketPath = conn.config.credentials.socketPath || '/var/run/signald/signald.sock';

    try {
      const net = await import('net');
      await new Promise<void>((resolve, reject) => {
        const socket = net.default.createConnection(socketPath);
        socket.setTimeout(3000);
        socket.on('connect', () => {
          const msg = JSON.stringify({
            type: 'send',
            username: conn.config.credentials.accountId,
            recipientAddress: { number: recipient },
            messageBody: content,
            id: `nexus-${Date.now()}`,
          }) + '\n';
          socket.write(msg);
          socket.end();
          resolve();
        });
        socket.on('error', reject);
        socket.on('timeout', () => reject(new Error('signald connection timeout')));
      });

      logger.info(`[SignalAdapter:${channelId}] Message sent to ${recipient}`);
      return { sent: true, to: recipient };
    } catch (err: any) {
      logger.warn(`[SignalAdapter:${channelId}] Failed — is signald running at ${socketPath}?`);
      return {
        error: `Signal send failed: ${err.message}. Ensure signald daemon is running at ${socketPath}.`,
        setupGuide: 'https://signald.org/articles/install/',
      };
    }
  }

  async getHistory?(channelId: string, limit?: number): Promise<ChannelMessage[]> {
    return [];
  }
}
