// Base utilities for Notion API
const NOTION_VERSION = '2025-09-03';

export function getApiKey(): string {
  const key = process.env.NOTION_API_KEY;
  if (!key) {
    throw new Error('NOTION_API_KEY environment variable not set');
  }
  return key;
}

export async function notionRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  const apiKey = getApiKey();
  const url = `https://api.notion.com/v1${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(`Notion API error: ${error.message || response.statusText}`);
  }

  return response.json();
}

export function formatPageId(pageId: string): string {
  // Remove dashes if present, then format as UUID
  const clean = pageId.replace(/-/g, '');
  if (clean.length === 32) {
    return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20)}`;
  }
  return pageId;
}
