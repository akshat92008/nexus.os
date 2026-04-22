import { notionRequest, formatPageId } from './base.js';

interface UpdatePageParams {
  page_id: string;
  properties: Record<string, any>;
}

export default async function updatePage(params: UpdatePageParams, _context: { config: Record<string, any> }): Promise<any> {
  const { page_id, properties } = params;
  const formattedId = formatPageId(page_id);

  const page = await notionRequest(`/pages/${formattedId}`, {
    method: 'PATCH',
    body: JSON.stringify({ properties })
  });

  return {
    success: true,
    id: page.id,
    url: page.url,
    last_edited_time: page.last_edited_time
  };
}
