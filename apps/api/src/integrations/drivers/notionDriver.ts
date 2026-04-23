/**
 * Nexus OS — Notion Integration Driver
 *
 * Pages, databases, blocks, search.
 */

export interface NotionPage {
  id: string;
  url: string;
  title: string;
  createdAt: string;
  lastEditedAt: string;
  icon?: string;
  cover?: string;
  properties: Record<string, any>;
  parentType: string;
}

export interface NotionDatabase {
  id: string;
  title: string;
  url: string;
  properties: Record<string, any>;
}

export interface CreatePageParams {
  parentDatabaseId?: string;
  parentPageId?: string;
  title: string;
  properties?: Record<string, any>;
  contentBlocks?: Array<{ type: string; content?: string; [key: string]: any }>;
}

export class NotionDriver {
  private token: string;
  private baseUrl = 'https://api.notion.com/v1';

  constructor(token: string) {
    this.token = token;
  }

  private async request(path: string, options?: RequestInit): Promise<any> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Notion API ${res.status}: ${text}`);
    }
    return res.json();
  }

  async searchPages(query: string, limit = 20): Promise<NotionPage[]> {
    const data = await this.request('/search', {
      method: 'POST',
      body: JSON.stringify({ query, page_size: limit }),
    });
    return (data.results || [])
      .filter((r: any) => r.object === 'page')
      .map(this.mapPage);
  }

  async getPage(pageId: string): Promise<NotionPage> {
    const data = await this.request(`/pages/${pageId}`);
    return this.mapPage(data);
  }

  async createPage(params: CreatePageParams): Promise<NotionPage> {
    const body: any = {
      properties: {
        title: { title: [{ text: { content: params.title } }] },
        ...params.properties,
      },
    };
    if (params.parentDatabaseId) {
      body.parent = { database_id: params.parentDatabaseId };
    } else if (params.parentPageId) {
      body.parent = { page_id: params.parentPageId };
    }
    if (params.contentBlocks) {
      body.children = params.contentBlocks.map(b => ({
        object: 'block',
        type: b.type,
        [b.type]: { rich_text: [{ type: 'text', text: { content: b.content || '' } }] },
      }));
    }
    const data = await this.request('/pages', { method: 'POST', body: JSON.stringify(body) });
    return this.mapPage(data);
  }

  async updatePage(pageId: string, updates: Partial<{ title: string; properties: Record<string, any>; icon: string; cover: string }>): Promise<void> {
    const body: any = { properties: { ...(updates.properties || {}) } };
    if (updates.title) {
      body.properties.title = { title: [{ text: { content: updates.title } }] };
    }
    if (updates.icon) body.icon = { emoji: updates.icon };
    if (updates.cover) body.cover = { external: { url: updates.cover } };
    await this.request(`/pages/${pageId}`, { method: 'PATCH', body: JSON.stringify(body) });
  }

  async getDatabases(): Promise<NotionDatabase[]> {
    const data = await this.request('/search', {
      method: 'POST',
      body: JSON.stringify({ filter: { value: 'database', property: 'object' }, page_size: 100 }),
    });
    return (data.results || []).map((r: any) => ({
      id: r.id,
      title: r.title?.map((t: any) => t.plain_text).join('') || 'Untitled',
      url: r.url,
      properties: r.properties,
    }));
  }

  async queryDatabase(databaseId: string, filter?: any): Promise<NotionPage[]> {
    const body: any = {};
    if (filter) body.filter = filter;
    const data = await this.request(`/databases/${databaseId}/query`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return (data.results || []).map(this.mapPage);
  }

  async createDatabaseItem(databaseId: string, properties: Record<string, any>): Promise<NotionPage> {
    const data = await this.request('/pages', {
      method: 'POST',
      body: JSON.stringify({ parent: { database_id: databaseId }, properties }),
    });
    return this.mapPage(data);
  }

  private mapPage(data: any): NotionPage {
    const title = data.properties?.title?.title?.map((t: any) => t.plain_text).join('')
      || data.properties?.Name?.title?.map((t: any) => t.plain_text).join('')
      || 'Untitled';
    return {
      id: data.id,
      url: data.url,
      title,
      createdAt: data.created_time,
      lastEditedAt: data.last_edited_time,
      icon: data.icon?.emoji,
      cover: data.cover?.external?.url,
      properties: data.properties || {},
      parentType: data.parent?.type,
    };
  }
}
