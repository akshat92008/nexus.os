/**
 * Nexus OS — Slack Integration Driver
 *
 * Messages, DMs, channels, file uploads, user info.
 */

export interface SlackMessage {
  ts: string;
  user?: string;
  text: string;
  threadTs?: string;
  attachments?: any[];
  reactions?: Array<{ name: string; count: number }>;
  subtype?: string;
}

export interface SlackUser {
  id: string;
  name: string;
  realName?: string;
  email?: string;
  avatar?: string;
  isBot: boolean;
}

export interface SlackChannel {
  id: string;
  name: string;
  isPrivate: boolean;
  memberCount?: number;
  topic?: string;
  purpose?: string;
}

export interface Block {
  type: string;
  [key: string]: any;
}

export class SlackDriver {
  private botToken: string;
  private baseUrl = 'https://slack.com/api';

  constructor(botToken: string) {
    this.botToken = botToken;
  }

  private async request(method: string, body?: any): Promise<any> {
    const res = await fetch(`${this.baseUrl}/${method}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.botToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!data.ok) {
      throw new Error(`Slack API error: ${data.error}`);
    }
    return data;
  }

  async sendMessage(channel: string, text: string, blocks?: Block[]): Promise<{ ts: string }> {
    const body: any = { channel, text };
    if (blocks) body.blocks = blocks;
    const data = await this.request('chat.postMessage', body);
    return { ts: data.ts };
  }

  async getMessages(channel: string, limit = 50): Promise<SlackMessage[]> {
    const data = await this.request('conversations.history', { channel, limit });
    return (data.messages || []).map((m: any) => ({
      ts: m.ts,
      user: m.user,
      text: m.text,
      threadTs: m.thread_ts,
      attachments: m.attachments,
      reactions: m.reactions?.map((r: any) => ({ name: r.name, count: r.count })),
      subtype: m.subtype,
    }));
  }

  async getDMs(userId: string, limit = 50): Promise<SlackMessage[]> {
    const convo = await this.request('conversations.open', { users: userId });
    return this.getMessages(convo.channel.id, limit);
  }

  async uploadFile(channel: string, file: Buffer, filename: string): Promise<void> {
    const form = new FormData();
    form.append('token', this.botToken);
    form.append('channels', channel);
    form.append('filename', filename);
    form.append('file', new Blob([file as unknown as BlobPart]), filename);

    const res = await fetch(`${this.baseUrl}/files.upload`, { method: 'POST', body: form });
    const data = await res.json();
    if (!data.ok) throw new Error(`Slack file upload error: ${data.error}`);
  }

  async getUserInfo(userId: string): Promise<SlackUser> {
    const data = await this.request('users.info', { user: userId });
    return {
      id: data.user.id,
      name: data.user.name,
      realName: data.user.real_name,
      email: data.user.profile?.email,
      avatar: data.user.profile?.image_512,
      isBot: data.user.is_bot,
    };
  }

  async listChannels(): Promise<SlackChannel[]> {
    const data = await this.request('conversations.list', { types: 'public_channel,private_channel', exclude_archived: true });
    return (data.channels || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      isPrivate: c.is_private,
      memberCount: c.num_members,
      topic: c.topic?.value,
      purpose: c.purpose?.value,
    }));
  }

  async createChannel(name: string, isPrivate = false): Promise<SlackChannel> {
    const method = isPrivate ? 'conversations.create' : 'channels.create';
    const data = await this.request(method, { name });
    const ch = data.channel;
    return {
      id: ch.id,
      name: ch.name,
      isPrivate: ch.is_private ?? false,
      memberCount: ch.num_members,
      topic: ch.topic?.value,
      purpose: ch.purpose?.value,
    };
  }

  async inviteToChannel(channelId: string, userIds: string[]): Promise<void> {
    await this.request('conversations.invite', { channel: channelId, users: userIds.join(',') });
  }
}
