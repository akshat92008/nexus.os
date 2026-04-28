/**
 * Nexus OS — Email Channel Adapter (IMAP/SMTP)
 */
import { type ChannelAdapter, type ChannelConfig, type ChannelMessage, channelManager } from '../channelManager.js';
import { logger } from '../../logger.js';
import { randomUUID } from 'crypto';

export class EmailAdapter implements ChannelAdapter {
  private connections: Map<string, any> = new Map();
  private checkIntervals: Map<string, NodeJS.Timeout> = new Map();

  async connect(config: ChannelConfig): Promise<void> {
    const { imapHost, imapPort, smtpHost, smtpPort, username, password, tls } = config.credentials;
    
    if (!username || !password) {
      logger.warn({ channelId: config.id }, '[EmailAdapter] Missing email credentials');
      return;
    }

    // In production, use node-imap for IMAP and nodemailer for SMTP
    // This is a stub that simulates the connection
    logger.info(`[EmailAdapter] Connecting to ${imapHost || smtpHost} for ${config.name}`);

    // Start polling for new emails
    const interval = setInterval(() => this.checkEmail(config), 60000);
    this.checkIntervals.set(config.id, interval);

    this.connections.set(config.id, {
      config,
      lastCheck: new Date(),
      connected: true
    });
  }

  async disconnect(channelId: string): Promise<void> {
    const interval = this.checkIntervals.get(channelId);
    if (interval) {
      clearInterval(interval);
      this.checkIntervals.delete(channelId);
    }
    this.connections.delete(channelId);
    logger.info(`[EmailAdapter] Disconnected ${channelId}`);
  }

  async sendMessage(channelId: string, content: string, options?: {
    to?: string;
    subject?: string;
    cc?: string[];
    bcc?: string[];
    attachments?: any[];
  }): Promise<any> {
    const conn = this.connections.get(channelId);
    if (!conn) return { error: 'Email channel not connected' };

    const { smtpHost, smtpPort, username, password, tls } = conn.config.credentials;

    if (!smtpHost || !username || !password) {
      return { error: 'SMTP credentials incomplete. Provide smtpHost, username, password.' };
    }

    if (!options?.to) {
      return { error: 'Recipient email (options.to) is required' };
    }

    try {
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.default.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort || '587'),
        secure: tls === true,
        auth: { user: username, pass: password },
      });

      const result = await transporter.sendMail({
        from: username,
        to: options.to,
        cc: options.cc?.join(','),
        bcc: options.bcc?.join(','),
        subject: options.subject || 'Nexus OS Message',
        text: content,
        attachments: options.attachments,
      });

      logger.info({ messageId: result.messageId, to: options.to }, `[EmailAdapter:${channelId}] Email sent`);
      return { sent: true, messageId: result.messageId };
    } catch (err: any) {
      logger.error({ err: err.message }, `[EmailAdapter:${channelId}] Send failed`);
      return { error: err.message };
    }
  }

  private async checkEmail(config: ChannelConfig) {
    // Use nodemailer's SMTP verify + a simple fetch-based approach
    // For production IMAP: install node-imap and replace this block
    try {
      const nodemailer = await import('nodemailer');
      const { imapHost, imapPort, username, password, tls } = config.credentials;

      if (!imapHost || !username || !password) {
        logger.debug(`[EmailAdapter:${config.id}] IMAP credentials incomplete — skipping check`);
        return;
      }

      // Use nodemailer's SMTP transport to verify connectivity
      // Full IMAP requires the `node-imap` package: pnpm add node-imap @types/node-imap
      // For now, verify SMTP is alive as a health check proxy
      const transporter = nodemailer.default.createTransport({
        host: config.credentials.smtpHost || imapHost,
        port: parseInt(config.credentials.smtpPort || '587'),
        secure: tls === true,
        auth: { user: username, pass: password },
      });

      await transporter.verify();
      logger.debug(`[EmailAdapter:${config.id}] SMTP connection verified OK`);
      
      // NOTE: Full IMAP inbox polling requires installing `node-imap`:
      //   pnpm add node-imap @types/node-imap
      // Then replace this block with:
      //   const Imap = await import('node-imap');
      //   const imap = new Imap({ user: username, password, host: imapHost, port: imapPort || 993, tls });
      //   imap.once('ready', () => { imap.openBox('INBOX', false, (err, box) => { ... }) });
      //   imap.connect();
      
    } catch (err: any) {
      logger.debug({ err: err.message }, `[EmailAdapter:${config.id}] Email check failed`);
    }
  }

  async getHistory?(channelId: string, limit?: number): Promise<ChannelMessage[]> {
    // In production: fetch last N emails via IMAP
    return [];
  }
}
