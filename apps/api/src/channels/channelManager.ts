/**
 * Nexus OS — Channel Manager
 * Multi-channel messaging system inspired by OpenClaw
 * Supports: Slack, Discord, Telegram, Email, WebSocket
 */
import { logger } from '../logger.js';
import { eventBus } from '../events/eventBus.js';
import { getSupabase } from '../storage/supabaseClient.js';
import { randomUUID } from 'crypto';

export type ChannelType = 'slack' | 'discord' | 'telegram' | 'email' | 'whatsapp' | 'sms' | 'webchat' | 'websocket' | 'matrix' | 'signal';

export interface ChannelMessage {
  id: string;
  channelId: string;
  channelType: ChannelType;
  senderId: string;
  senderName: string;
  content: string;
  attachments?: Attachment[];
  timestamp: Date;
  threadId?: string;
  replyTo?: string;
  metadata?: Record<string, any>;
}

export interface Attachment {
  id: string;
  type: 'image' | 'file' | 'audio' | 'video';
  url: string;
  name: string;
  size?: number;
  mimeType?: string;
}

export interface ChannelConfig {
  id: string;
  type: ChannelType;
  name: string;
  workspaceId: string;
  credentials: Record<string, string>;
  settings: {
    autoReply: boolean;
    dmPolicy: 'open' | 'pairing' | 'closed';
    allowFrom: string[];
    webhooks?: string[];
  };
  isActive: boolean;
  lastConnectedAt?: Date;
}

export interface DMPairingRequest {
  id: string;
  channelId: string;
  senderId: string;
  senderName: string;
  code: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
}

class ChannelManager {
  private channels: Map<string, ChannelConfig> = new Map();
  private adapters: Map<ChannelType, ChannelAdapter> = new Map();
  private pairingRequests: Map<string, DMPairingRequest> = new Map();

  async initialize() {
    logger.info('[ChannelManager] Initializing multi-channel system...');
    
    // Load active channels from database
    await this.loadChannels();
    
    // Subscribe to agent responses
    eventBus.subscribe('agent_response', this.handleAgentResponse.bind(this));
    
    logger.info(`[ChannelManager] Loaded ${this.channels.size} channels`);
  }

  private async loadChannels() {
    const supabase = await getSupabase();
    const { data: channels, error } = await supabase
      .from('channel_configs')
      .select('*')
      .eq('is_active', true);

    if (error) {
      logger.error({ err: error }, '[ChannelManager] Failed to load channels');
      return;
    }

    for (const channel of channels || []) {
      this.channels.set(channel.id, channel as ChannelConfig);
      await this.connectChannel(channel as ChannelConfig);
    }
  }

  registerAdapter(type: ChannelType, adapter: ChannelAdapter) {
    this.adapters.set(type, adapter);
    logger.info(`[ChannelManager] Registered adapter for ${type}`);
  }

  async connectChannel(config: ChannelConfig) {
    const adapter = this.adapters.get(config.type);
    if (!adapter) {
      logger.warn(`[ChannelManager] No adapter for channel type: ${config.type}`);
      return;
    }

    try {
      await adapter.connect(config);
      await this.updateChannelStatus(config.id, 'connected');
      logger.info(`[ChannelManager] Connected ${config.type} channel: ${config.name}`);
    } catch (err) {
      logger.error({ err }, `[ChannelManager] Failed to connect ${config.type} channel`);
      await this.updateChannelStatus(config.id, 'error');
    }
  }

  async disconnectChannel(channelId: string) {
    const config = this.channels.get(channelId);
    if (!config) return;

    const adapter = this.adapters.get(config.type);
    if (adapter) {
      await adapter.disconnect(channelId);
    }

    this.channels.delete(channelId);
    await this.updateChannelStatus(channelId, 'disconnected');
  }

  async receiveMessage(message: ChannelMessage) {
    logger.info(`[ChannelManager] Received message from ${message.channelType}: ${message.senderName}`);

    // Check DM policy
    const config = this.channels.get(message.channelId);
    if (!config) return;

    if (config.settings.dmPolicy === 'pairing') {
      const isPaired = await this.isSenderPaired(message.channelId, message.senderId);
      if (!isPaired) {
        await this.handlePairingRequest(message);
        return;
      }
    }

    // Check allowlist
    if (config.settings.allowFrom.length > 0) {
      if (!config.settings.allowFrom.includes(message.senderId) && 
          !config.settings.allowFrom.includes('*')) {
        logger.warn(`[ChannelManager] Message from ${message.senderId} blocked by allowlist`);
        return;
      }
    }

    // Store message
    await this.storeMessage(message);

    // Publish to event bus for agent processing
    await eventBus.publish('channel_message', {
      type: 'channel_message',
      message,
      timestamp: Date.now()
    });

    // Auto-reply if enabled
    if (config.settings.autoReply) {
      await this.requestAgentResponse(message);
    }
  }

  async sendMessage(channelId: string, content: string, options?: {
    threadId?: string;
    attachments?: Attachment[];
    metadata?: Record<string, any>;
  }) {
    const config = this.channels.get(channelId);
    if (!config) {
      throw new Error(`Channel ${channelId} not found`);
    }

    const adapter = this.adapters.get(config.type);
    if (!adapter) {
      throw new Error(`No adapter for channel type: ${config.type}`);
    }

    return adapter.sendMessage(channelId, content, options);
  }

  async broadcastMessage(content: string, filter?: { workspaceId?: string; types?: ChannelType[] }) {
    const results = [];
    
    for (const [id, config] of this.channels) {
      if (filter?.workspaceId && config.workspaceId !== filter.workspaceId) continue;
      if (filter?.types && !filter.types.includes(config.type)) continue;

      try {
        const result = await this.sendMessage(id, content);
        results.push({ channelId: id, success: true, result });
      } catch (err) {
        results.push({ channelId: id, success: false, error: (err as Error).message });
      }
    }

    return results;
  }

  private async handlePairingRequest(message: ChannelMessage) {
    const code = this.generatePairingCode();
    const request: DMPairingRequest = {
      id: randomUUID(),
      channelId: message.channelId,
      senderId: message.senderId,
      senderName: message.senderName,
      code,
      status: 'pending',
      createdAt: new Date()
    };

    this.pairingRequests.set(request.id, request);

    // Send pairing code to sender
    await this.sendMessage(message.channelId, 
      `🔒 Your pairing code is: **${code}**\n\n` +
      `To approve, use: \`nexus pairing approve ${message.channelType} ${code}\``,
      { threadId: message.threadId }
    );

    logger.info(`[ChannelManager] Pairing request created: ${code} for ${message.senderName}`);
  }

  async approvePairing(code: string): Promise<boolean> {
    for (const [id, request] of this.pairingRequests) {
      if (request.code === code && request.status === 'pending') {
        request.status = 'approved';
        
        // Store approved sender
        const supabase = await getSupabase();
        await supabase.from('channel_approved_senders').upsert({
          channel_id: request.channelId,
          sender_id: request.senderId,
          sender_name: request.senderName,
          approved_at: new Date().toISOString()
        });

        // Notify sender
        await this.sendMessage(request.channelId, 
          `✅ Pairing approved! You can now message me.`,
          { threadId: request.channelId }
        );

        logger.info(`[ChannelManager] Pairing approved: ${code}`);
        return true;
      }
    }
    return false;
  }

  private async isSenderPaired(channelId: string, senderId: string): Promise<boolean> {
    const supabase = await getSupabase();
    const { data } = await supabase
      .from('channel_approved_senders')
      .select('id')
      .eq('channel_id', channelId)
      .eq('sender_id', senderId)
      .single();

    return !!data;
  }

  private async handleAgentResponse(event: any) {
    const { channelId, content, threadId } = event;
    if (!channelId) return;

    try {
      await this.sendMessage(channelId, content, { threadId });
    } catch (err) {
      logger.error({ err }, '[ChannelManager] Failed to send agent response');
    }
  }

  private async storeMessage(message: ChannelMessage) {
    const supabase = await getSupabase();
    await supabase.from('channel_messages').insert({
      id: message.id,
      channel_id: message.channelId,
      sender_id: message.senderId,
      sender_name: message.senderName,
      content: message.content,
      attachments: message.attachments,
      thread_id: message.threadId,
      created_at: message.timestamp.toISOString()
    });
  }

  private async updateChannelStatus(channelId: string, status: string) {
    const supabase = await getSupabase();
    await supabase
      .from('channel_configs')
      .update({ status, last_connected_at: new Date().toISOString() })
      .eq('id', channelId);
  }

  private async requestAgentResponse(message: ChannelMessage) {
    // Trigger agent processing
    await eventBus.publish('agent_request', {
      type: 'agent_request',
      source: 'channel',
      channelType: message.channelType,
      channelId: message.channelId,
      messageId: message.id,
      senderId: message.senderId,
      senderName: message.senderName,
      content: message.content,
      timestamp: Date.now()
    });
  }

  private generatePairingCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  getActiveChannels(): ChannelConfig[] {
    return Array.from(this.channels.values());
  }

  getChannel(channelId: string): ChannelConfig | undefined {
    return this.channels.get(channelId);
  }
}

export interface ChannelAdapter {
  connect(config: ChannelConfig): Promise<void>;
  disconnect(channelId: string): Promise<void>;
  sendMessage(channelId: string, content: string, options?: any): Promise<any>;
  onMessage?(handler: (message: ChannelMessage) => void): void;
}

export const channelManager = new ChannelManager();
