import { notionRequest, formatPageId } from './base.js';

interface GetPageParams {
  page_id: string;
}

export default async function getPage(params: GetPageParams, _context: { config: Record<string, any> }): Promise<any> {
  const { page_id } = params;
  const formattedId = formatPageId(page_id);

  const page = await notionRequest(`/pages/${formattedId}`);

  // Extract title
  let title = 'Untitled';
  const titleProp = Object.values(page.properties || {}).find((p: any) => p.type === 'title');
  if (titleProp && (titleProp as any).title) {
    title = (titleProp as any).title.map((t: any) => t.text?.content || '').join('');
  }

  return {
    success: true,
    id: page.id,
    title,
    url: page.url,
    created_time: page.created_time,
    last_edited_time: page.last_edited_time,
    properties: page.properties
  };
}
