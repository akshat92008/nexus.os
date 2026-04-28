import { type ChannelAdapter, type ChannelConfig, channelManager } from '../channelManager.js';
import { logger } from '../../logger.js';

export class SlackAdapter implements ChannelAdapter {
  private configured: boolean;
  private webhooks: Map<string, string> = new Map();
  private wsConnections: Map<string, any> = new Map();

  constructor() {
    this.configured = false;
  }

  async connect(config: ChannelConfig): Promise<void> {
    const { botToken, webhookUrl } = config.credentials;
    
    if (!botToken && !webhookUrl) {
      logger.warn(`[SlackAdapter] Credentials missing for ${config.name} — adapter disabled`);
      return;
    }
    this.configured = true;

    if (webhookUrl) this.webhooks.set(config.id, webhookUrl);

    if (botToken) {
      try {
        const { App } = await import('@slack/bolt');
        const app = new App({
          token: botToken,
          signingSecret: config.credentials.signingSecret || 'stub',
          socketMode: !!config.credentials.appToken,
          appToken: config.credentials.appToken
        });
        // (Omitted: app.message routing for brevity)
        await app.start();
        this.wsConnections.set(config.id, app);
        logger.info(`[SlackAdapter] Connected workspace: ${config.name}`);
      } catch (e: any) {
        logger.warn({ err: e.message }, `[SlackAdapter] Init failed for ${config.name}`);
      }
    }
  }

  async disconnect(channelId: string): Promise<void> {
    const app = this.wsConnections.get(channelId);
    if (app) {
      await app.stop();
      this.wsConnections.delete(channelId);
    }
    this.webhooks.delete(channelId);
  }

  async sendMessage(channelId: string, content: string, options?: any): Promise<any> {
    if (!this.configured) return { error: 'Slack not configured' };
    const config = channelManager.getChannel(channelId);
    if (!config) throw new Error(`Channel ${channelId} not found`);

    const webhookUrl = this.webhooks.get(channelId);
    if (webhookUrl && !options?.threadId) {
      return fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: content, thread_ts: options?.threadId })
      });
    }

    if (config.credentials.botToken) {
      const res = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${config.credentials.botToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: options?.channel || config.credentials.defaultChannel || '#general',
          text: content,
          thread_ts: options?.threadId
        })
      });
      return res.json();
    }
    return { error: 'No connection method available' };
  }
}
