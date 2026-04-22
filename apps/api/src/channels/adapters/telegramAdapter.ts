/**
 * Nexus OS — Telegram Channel Adapter
 */
import { type ChannelAdapter, type ChannelConfig, type ChannelMessage, channelManager } from '../channelManager.js';
import { logger } from '../../logger.js';
import { randomUUID } from 'crypto';

export class TelegramAdapter implements ChannelAdapter {
  private bots: Map<string, any> = new Map();

  async connect(config: ChannelConfig): Promise<void> {
    const { botToken } = config.credentials;
    if (!botToken) throw new Error('Telegram bot token required');

    const { Telegraf } = await import('telegraf');
    const bot = new Telegraf(botToken);

    bot.on('message', async (ctx) => {
      const message = ctx.message;
      const chat = ctx.chat;

      let content = '';
      if ('text' in message && message.text) {
        content = message.text;
      } else if ('caption' in message && message.caption) {
        content = message.caption;
      } else {
        content = '[Non-text message]';
      }

      const channelMessage: ChannelMessage = {
        id: randomUUID(),
        channelId: config.id,
        channelType: 'telegram',
        senderId: String(message.from?.id || chat.id),
        senderName: message.from?.username || message.from?.first_name || 'Unknown',
        content,
        timestamp: new Date(message.date * 1000),
        threadId: message.message_thread_id ? String(message.message_thread_id) : String(chat.id),
        metadata: {
          chatId: chat.id,
          chatType: chat.type,
          messageId: message.message_id,
          raw: message
        }
      };

      await channelManager.receiveMessage(channelMessage);
    });

    await bot.launch();
    this.bots.set(config.id, bot);

    logger.info(`[TelegramAdapter] Connected bot: ${config.name}`);
  }

  async disconnect(channelId: string): Promise<void> {
    const bot = this.bots.get(channelId);
    if (bot) {
      bot.stop();
      this.bots.delete(channelId);
    }
  }

  async sendMessage(channelId: string, content: string, options?: { 
    threadId?: string;
    parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
    replyToMessageId?: number;
  }): Promise<any> {
    const bot = this.bots.get(channelId);
    if (!bot) throw new Error(`Telegram bot for ${channelId} not connected`);

    const config = channelManager.getChannel(channelId);
    const chatId = options?.threadId || config?.credentials.defaultChatId;
    
    if (!chatId) throw new Error('Chat ID required for Telegram messages');

    return bot.telegram.sendMessage(chatId, content, {
      parse_mode: options?.parseMode || 'Markdown',
      reply_to_message_id: options?.replyToMessageId
    });
  }
}
