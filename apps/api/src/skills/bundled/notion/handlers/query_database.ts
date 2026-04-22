import { notionRequest, formatPageId } from './base.js';

interface QueryDatabaseParams {
  database_id: string;
  filter?: Record<string, any>;
}

export default async function queryDatabase(params: QueryDatabaseParams, _context: { config: Record<string, any> }): Promise<any> {
  const { database_id, filter } = params;
  const formattedId = formatPageId(database_id);

  const body: any = {};
  if (filter) {
    body.filter = filter;
  }

  const data = await notionRequest(`/data_sources/${formattedId}/query`, {
    method: 'POST',
    body: JSON.stringify(body)
  });

  // Simplify results
  const results = data.results?.map((page: any) => {
    let title = 'Untitled';
    const titleProp = Object.values(page.properties || {}).find((p: any) => p.type === 'title');
    if (titleProp && (titleProp as any).title) {
      title = (titleProp as any).title.map((t: any) => t.text?.content || '').join('');
    }

    return {
      id: page.id,
      title,
      url: page.url,
      created_time: page.created_time,
      last_edited_time: page.last_edited_time,
      properties: page.properties
    };
  }) || [];

  return {
    success: true,
    database_id: formattedId,
    total: data.results?.length || 0,
    has_more: data.has_more,
    results
  };
}
