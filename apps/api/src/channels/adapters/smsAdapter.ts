/**
 * Nexus OS — SMS Channel Adapter
 * Uses macOS iMessage bridge or Twilio for SMS
 */
import { type ChannelAdapter, type ChannelConfig, type ChannelMessage, channelManager } from '../channelManager.js';
import { logger } from '../../logger.js';
import { randomUUID } from 'crypto';

export class SmsAdapter implements ChannelAdapter {
  private configs: Map<string, ChannelConfig> = new Map();

  async connect(config: ChannelConfig): Promise<void> {
    // SMS can work through:
    // 1. macOS Messages app (via AppleScript) — free, local
    // 2. Twilio API — requires account
    // 3. Local modem/dongle — hardware required
    
    logger.info(`[SmsAdapter] SMS channel ready for ${config.name}`);
    this.configs.set(config.id, config);
  }

  async disconnect(channelId: string): Promise<void> {
    this.configs.delete(channelId);
    logger.info(`[SmsAdapter] Disconnected ${channelId}`);
  }

  async sendMessage(channelId: string, content: string, options?: { 
    threadId?: string; // phone number
  }): Promise<any> {
    const config = this.configs.get(channelId);
    if (!config) throw new Error(`SMS channel ${channelId} not connected`);

    const phoneNumber = options?.threadId;
    if (!phoneNumber) throw new Error('Phone number (threadId) required for SMS');

    // Try macOS Messages first (free)
    try {
      const { execFile } = await import('child_process');
      const { promisify } = await import('util');
      
      await promisify(execFile)('osascript', ['-e',
        `tell application "Messages"
           set targetService to 1st service whose service type = SMS
           set targetBuddy to buddy "${phoneNumber}" of targetService
           send "${content.replace(/"/g, '\\"')}" to targetBuddy
         end tell`
      ]);

      return {
        messageId: randomUUID(),
        sent: true,
        to: phoneNumber,
        via: 'macos-messages'
      };
    } catch (err: any) {
      logger.warn(`[SmsAdapter] macOS Messages failed: ${err.message}`);
      
      // Fallback to Twilio if configured
      const { twilioSid, twilioToken, twilioPhone } = config.credentials;
      if (twilioSid && twilioToken) {
        const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
        const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
          method: 'POST',
          headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ From: twilioPhone, To: phoneNumber, Body: content })
        });

        if (!response.ok) throw new Error(`Twilio error: ${response.statusText}`);
        const data = await response.json();
        return { messageId: data.sid, sent: true, to: phoneNumber, via: 'twilio' };
      }

      throw new Error('SMS send failed. Configure Twilio credentials or use macOS Messages.');
    }
  }
}
