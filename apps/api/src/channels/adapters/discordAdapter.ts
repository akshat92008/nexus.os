/**
 * Nexus OS — Discord Channel Adapter
 */
import { type ChannelAdapter, type ChannelConfig, type ChannelMessage, channelManager } from '../channelManager.js';
import { logger } from '../../logger.js';
import { randomUUID } from 'crypto';

export class DiscordAdapter implements ChannelAdapter {
  private clients: Map<string, any> = new Map();

  async connect(config: ChannelConfig): Promise<void> {
    const { botToken } = config.credentials;
    if (!botToken) throw new Error('Discord bot token required');

    const { Client, GatewayIntentBits, Events } = await import('discord.js');

    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
      ]
    });

    client.on(Events.MessageCreate, async (message) => {
      if (message.author.bot) return;

      const channelMessage: ChannelMessage = {
        id: randomUUID(),
        channelId: config.id,
        channelType: 'discord',
        senderId: message.author.id,
        senderName: message.author.username,
        content: message.content,
        timestamp: message.createdAt,
        threadId: message.thread?.id || message.channel.id,
        metadata: {
          guildId: message.guild?.id,
          channelId: message.channel.id,
          isDM: message.channel.isDMBased?.(),
          raw: message.toJSON()
        }
      };

      await channelManager.receiveMessage(channelMessage);
    });

    await client.login(botToken);
    this.clients.set(config.id, client);
    
    logger.info(`[DiscordAdapter] Connected bot: ${config.name}`);
  }

  async disconnect(channelId: string): Promise<void> {
    const client = this.clients.get(channelId);
    if (client) {
      client.destroy();
      this.clients.delete(channelId);
    }
  }

  async sendMessage(channelId: string, content: string, options?: { 
    threadId?: string;
    channelId?: string;
    embeds?: any[];
  }): Promise<any> {
    const client = this.clients.get(channelId);
    if (!client) throw new Error(`Discord client for ${channelId} not connected`);

    const targetChannelId = options?.channelId || options?.threadId;
    if (!targetChannelId) throw new Error('Channel ID required for Discord messages');

    const channel = await client.channels.fetch(targetChannelId);
    if (!channel || !channel.isTextBased()) {
      throw new Error('Target channel not found or not text-based');
    }

    const payload: any = { content };
    if (options?.embeds) payload.embeds = options.embeds;

    return channel.send(payload);
  }
}
