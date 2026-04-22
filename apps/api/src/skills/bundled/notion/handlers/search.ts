import { notionRequest } from './base.js';

interface SearchParams {
  query: string;
}

export default async function search(params: SearchParams, _context: { config: Record<string, any> }): Promise<any> {
  const { query } = params;

  const data = await notionRequest('/search', {
    method: 'POST',
    body: JSON.stringify({ query })
  });

  const pages = data.results?.filter((r: any) => r.object === 'page') || [];
  const databases = data.results?.filter((r: any) => r.object === 'database' || r.object === 'data_source') || [];

  return {
    success: true,
    query,
    total: data.results?.length || 0,
    pages: pages.map((p: any) => ({
      id: p.id,
      title: p.properties?.title?.title?.[0]?.text?.content || 'Untitled',
      url: p.url,
      created_time: p.created_time,
      last_edited_time: p.last_edited_time
    })),
    databases: databases.map((d: any) => ({
      id: d.id,
      title: d.title?.[0]?.text?.content || d.properties?.title?.title?.[0]?.text?.content || 'Untitled',
      url: d.url,
      created_time: d.created_time
    }))
  };
}
