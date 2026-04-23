/**
 * Nexus OS — Gmail Integration Driver
 *
 * Uses Google OAuth2 + Gmail API for read, draft, send, label operations.
 * Tokens stored encrypted in Supabase user_integrations table.
 */
import { createClient } from '@supabase/supabase-js';

export interface EmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string[];
  date: string;
  snippet: string;
  bodyText?: string;
  bodyHtml?: string;
  labels: string[];
  isUnread: boolean;
  attachments: Array<{ filename: string; mimeType: string; size: number }>;
}

export interface Draft {
  id: string;
  messageId?: string;
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
}

export interface Thread {
  id: string;
  messages: EmailMessage[];
}

export class GmailDriver {
  private accessToken: string;
  private baseUrl = 'https://gmail.googleapis.com/gmail/v1';

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async request(path: string, options?: RequestInit): Promise<any> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Gmail API ${res.status}: ${text}`);
    }
    return res.json();
  }

  async listMessages(query = '', maxResults = 50): Promise<EmailMessage[]> {
    const data = await this.request(`/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`);
    if (!data.messages) return [];

    const messages = await Promise.all(
      data.messages.map((m: any) => this.getMessage(m.id).catch(() => null))
    );
    return messages.filter(Boolean) as EmailMessage[];
  }

  async getMessage(messageId: string): Promise<EmailMessage> {
    const data = await this.request(`/users/me/messages/${messageId}?format=full`);
    const headers = data.payload.headers || [];
    const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    const extractBody = (parts: any[]): { text?: string; html?: string } => {
      for (const part of parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          return { text: Buffer.from(part.body.data, 'base64').toString('utf-8'), html: undefined };
        }
        if (part.mimeType === 'text/html' && part.body?.data) {
          return { text: undefined, html: Buffer.from(part.body.data, 'base64').toString('utf-8') };
        }
        if (part.parts) {
          const nested = extractBody(part.parts);
          if (nested.text || nested.html) return nested;
        }
      }
      return {};
    };

    const body = data.payload.parts ? extractBody(data.payload.parts) : {};

    return {
      id: data.id,
      threadId: data.threadId,
      subject: getHeader('Subject'),
      from: getHeader('From'),
      to: getHeader('To').split(',').map((s: string) => s.trim()).filter(Boolean),
      date: getHeader('Date'),
      snippet: data.snippet,
      bodyText: body.text,
      bodyHtml: body.html,
      labels: data.labelIds || [],
      isUnread: (data.labelIds || []).includes('UNREAD'),
      attachments: (data.payload.parts || [])
        .filter((p: any) => p.body?.attachmentId)
        .map((p: any) => ({ filename: p.filename, mimeType: p.mimeType, size: p.body.size })),
    };
  }

  async getThread(threadId: string): Promise<Thread> {
    const data = await this.request(`/users/me/threads/${threadId}?format=full`);
    const messages = await Promise.all(
      (data.messages || []).map((m: any) => this.getMessage(m.id).catch(() => null))
    );
    return { id: threadId, messages: messages.filter(Boolean) as EmailMessage[] };
  }

  async draftEmail(to: string[], subject: string, body: string, replyTo?: string, cc?: string[]): Promise<Draft> {
    const raw = this.buildRawMessage(to, subject, body, replyTo, cc);
    const data = await this.request('/users/me/drafts', {
      method: 'POST',
      body: JSON.stringify({ message: { raw } }),
    });
    return {
      id: data.id,
      messageId: data.message?.id,
      to,
      cc,
      subject,
      body,
    };
  }

  async sendEmail(draftId: string): Promise<void> {
    await this.request(`/users/me/drafts/send`, {
      method: 'POST',
      body: JSON.stringify({ id: draftId }),
    });
  }

  async sendDirect(to: string[], subject: string, body: string): Promise<void> {
    const raw = this.buildRawMessage(to, subject, body);
    await this.request('/users/me/messages/send', {
      method: 'POST',
      body: JSON.stringify({ raw }),
    });
  }

  async createLabel(name: string): Promise<{ id: string; name: string }> {
    const data = await this.request('/users/me/labels', {
      method: 'POST',
      body: JSON.stringify({ name, labelListVisibility: 'labelShow', messageListVisibility: 'show' }),
    });
    return { id: data.id, name: data.name };
  }

  async moveToLabel(messageId: string, labelId: string): Promise<void> {
    await this.request(`/users/me/messages/${messageId}/modify`, {
      method: 'POST',
      body: JSON.stringify({ addLabelIds: [labelId] }),
    });
  }

  async markAsRead(messageId: string): Promise<void> {
    await this.request(`/users/me/messages/${messageId}/modify`, {
      method: 'POST',
      body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
    });
  }

  async searchContacts(query: string): Promise<Array<{ name: string; email: string }>> {
    // Uses Google People API via Directory or Contacts API
    // Simplified: search in sent messages to infer contacts
    const sent = await this.listMessages(`in:sent ${query}`, 20);
    const contacts = new Map<string, { name: string; email: string; count: number }>();
    for (const msg of sent) {
      for (const email of msg.to) {
        const match = email.match(/(.+?)\s*<(.+)>/);
        const name = match ? match[1].trim() : email;
        const addr = match ? match[2].trim() : email;
        const existing = contacts.get(addr);
        contacts.set(addr, { name, email: addr, count: (existing?.count || 0) + 1 });
      }
    }
    return Array.from(contacts.values()).sort((a, b) => b.count - a.count);
  }

  private buildRawMessage(to: string[], subject: string, body: string, replyTo?: string, cc?: string[]): string {
    const headers = [
      'Content-Type: text/plain; charset=utf-8',
      'MIME-Version: 1.0',
      `To: ${to.join(', ')}`,
      cc && cc.length ? `Cc: ${cc.join(', ')}` : '',
      `Subject: ${subject}`,
      replyTo ? `In-Reply-To: ${replyTo}` : '',
    ].filter(Boolean);
    const raw = [...headers, '', body].join('\r\n');
    return Buffer.from(raw).toString('base64url');
  }
}
