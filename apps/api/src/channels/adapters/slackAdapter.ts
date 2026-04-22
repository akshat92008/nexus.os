/**
 * Nexus OS — Slack Channel Adapter
 */
import { type ChannelAdapter, type ChannelConfig, type ChannelMessage, channelManager } from '../channelManager.js';
import { logger } from '../../logger.js';
import { randomUUID } from 'crypto';

export class SlackAdapter implements ChannelAdapter {
  private webhooks: Map<string, string> = new Map();
  private wsConnections: Map<string, any> = new Map();

  async connect(config: ChannelConfig): Promise<void> {
    const { botToken, webhookUrl } = config.credentials;
    
    if (webhookUrl) {
      this.webhooks.set(config.id, webhookUrl);
    }

    // Initialize Slack Bolt app if bot token provided
    if (botToken) {
      const { App } = await import('@slack/bolt');
      
      const app = new App({
        token: botToken,
        signingSecret: config.credentials.signingSecret,
        socketMode: true,
        appToken: config.credentials.appToken
      });

      app.message(async ({ message, say }) => {
        const slackMessage = message as any;
        
        const channelMessage: ChannelMessage = {
          id: randomUUID(),
          channelId: config.id,
          channelType: 'slack',
          senderId: slackMessage.user || slackMessage.bot_id || 'unknown',
          senderName: slackMessage.username || 'Unknown',
          content: slackMessage.text || '',
          timestamp: new Date(Number(slackMessage.ts) * 1000),
          threadId: slackMessage.thread_ts || undefined,
          metadata: { channel: slackMessage.channel, raw: slackMessage }
        };

        await channelManager.receiveMessage(channelMessage);
      });

      await app.start();
      this.wsConnections.set(config.id, app);
    }

    logger.info(`[SlackAdapter] Connected workspace: ${config.name}`);
  }

  async disconnect(channelId: string): Promise<void> {
    const app = this.wsConnections.get(channelId);
    if (app) {
      await app.stop();
      this.wsConnections.delete(channelId);
    }
    this.webhooks.delete(channelId);
  }

  async sendMessage(channelId: string, content: string, options?: { 
    threadId?: string; 
    channel?: string;
    attachments?: any[];
  }): Promise<any> {
    const config = channelManager.getChannel(channelId);
    if (!config) throw new Error(`Channel ${channelId} not found`);

    // Try webhook first
    const webhookUrl = this.webhooks.get(channelId);
    if (webhookUrl && !options?.threadId) {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: content,
          thread_ts: options?.threadId
        })
      });
      return response;
    }

    // Fall back to API
    if (config.credentials.botToken) {
      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.credentials.botToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          channel: options?.channel || config.credentials.defaultChannel || '#general',
          text: content,
          thread_ts: options?.threadId
        })
      });
      return response.json();
    }

    throw new Error('No valid Slack connection method available');
  }
}
