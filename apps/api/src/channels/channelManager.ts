import { logger } from '../logger.js';

export type ChannelType =
  | 'slack'
  | 'discord'
  | 'telegram'
  | 'email'
  | 'whatsapp'
  | 'sms'
  | 'signal'
  | 'matrix';

export interface ChannelConfig {
  id: string;
  name: string;
  type: ChannelType;
  credentials: Record<string, any>;
  enabled?: boolean;
  metadata?: Record<string, any>;
}

export interface ChannelMessage {
  id: string;
  channelId: string;
  channelType: ChannelType | string;
  senderId: string;
  senderName?: string;
  content: string;
  timestamp: Date;
  threadId?: string;
  metadata?: Record<string, any>;
}

export interface ChannelAdapter {
  connect(config: ChannelConfig): Promise<void>;
  disconnect(channelId: string): Promise<void>;
  sendMessage(channelId: string, content: string, options?: any): Promise<any>;
  getHistory?(channelId: string, limit?: number): Promise<ChannelMessage[]>;
}

type AdapterFactory = () => Promise<ChannelAdapter>;

class ChannelManager {
  private adapters = new Map<ChannelType, ChannelAdapter>();
  private adapterFactories = new Map<ChannelType, AdapterFactory>();
  private channels = new Map<string, ChannelConfig>();
  private messages: ChannelMessage[] = [];
  private initialized = false;

  constructor() {
    this.adapterFactories.set('slack', async () => new (await import('./adapters/slackAdapter.js')).SlackAdapter());
    this.adapterFactories.set('discord', async () => new (await import('./adapters/discordAdapter.js')).DiscordAdapter());
    this.adapterFactories.set('email', async () => new (await import('./adapters/emailAdapter.js')).EmailAdapter());
    this.adapterFactories.set('sms', async () => new (await import('./adapters/smsAdapter.js')).SMSAdapter());
    this.adapterFactories.set('signal', async () => new (await import('./adapters/signalAdapter.js')).SignalAdapter());
    this.adapterFactories.set('matrix', async () => new (await import('./adapters/matrixAdapter.js')).MatrixAdapter());
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    for (const [type, factory] of this.adapterFactories.entries()) {
      try {
        const adapter = await factory();
        this.adapters.set(type, adapter);
      } catch (err) {
        logger.warn({ err, type }, '[ChannelManager] Adapter unavailable');
      }
    }

    logger.info({ adapterCount: this.adapters.size }, '[ChannelManager] Ready');
  }

  registerChannel(config: ChannelConfig): void {
    this.channels.set(config.id, config);
  }

  getChannel(channelId: string): ChannelConfig | undefined {
    return this.channels.get(channelId);
  }

  listChannels(): ChannelConfig[] {
    return Array.from(this.channels.values());
  }

  getMessages(limit = 100): ChannelMessage[] {
    return this.messages.slice(0, limit);
  }

  getStatus() {
    return Array.from(this.channels.values()).map((channel) => ({
      id: channel.id,
      name: channel.name,
      type: channel.type,
      enabled: channel.enabled !== false,
      connected: this.adapters.has(channel.type),
    }));
  }

  async connectChannel(channelId: string): Promise<void> {
    const channel = this.channels.get(channelId);
    if (!channel) throw new Error(`Channel ${channelId} not found`);

    await this.initialize();
    const adapter = this.adapters.get(channel.type);
    if (!adapter) {
      logger.warn({ channelId, type: channel.type }, '[ChannelManager] Adapter missing');
      return;
    }

    if (channel.enabled === false) {
      logger.info({ channelId }, '[ChannelManager] Skipping disabled channel');
      return;
    }

    await adapter.connect(channel);
  }

  async disconnectChannel(channelId: string): Promise<void> {
    const channel = this.channels.get(channelId);
    if (!channel) return;
    const adapter = this.adapters.get(channel.type);
    if (!adapter) return;
    await adapter.disconnect(channelId);
  }

  async sendMessage(channelId: string, content: string, options?: any): Promise<any> {
    const channel = this.channels.get(channelId);
    if (!channel) {
      return { error: `Channel ${channelId} not found` };
    }

    await this.initialize();
    const adapter = this.adapters.get(channel.type);
    if (!adapter) {
      return { error: `${channel.type} adapter not available` };
    }

    return adapter.sendMessage(channelId, content, options);
  }

  async receiveMessage(message: ChannelMessage): Promise<void> {
    this.messages.unshift(message);
    if (this.messages.length > 1000) {
      this.messages.length = 1000;
    }

    logger.info(
      {
        channelId: message.channelId,
        channelType: message.channelType,
        senderId: message.senderId,
      },
      '[ChannelManager] Message received',
    );
  }
}

export const channelManager = new ChannelManager();

