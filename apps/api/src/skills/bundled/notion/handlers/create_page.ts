import { notionRequest, formatPageId } from './base.js';

interface CreatePageParams {
  parent_id: string;
  title: string;
  content?: string;
  properties?: Record<string, any>;
}

export default async function createPage(params: CreatePageParams, _context: { config: Record<string, any> }): Promise<any> {
  const { parent_id, title, content, properties } = params;
  const formattedId = formatPageId(parent_id);

  // Determine if parent is a database or page
  const parentInfo = await notionRequest(`/pages/${formattedId}`).catch(() => null);
  const isDatabase = !parentInfo;

  const body: any = {
    parent: isDatabase
      ? { database_id: formattedId }
      : { page_id: formattedId },
    properties: {
      title: {
        title: [{ text: { content: title } }]
      }
    }
  };

  // Add custom properties if provided (for database entries)
  if (properties && isDatabase) {
    Object.assign(body.properties, properties);
  }

  // Add content if provided
  if (content) {
    body.children = [
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ type: 'text', text: { content } }]
        }
      }
    ];
  }

  const page = await notionRequest('/pages', {
    method: 'POST',
    body: JSON.stringify(body)
  });

  return {
    success: true,
    id: page.id,
    title,
    url: page.url,
    created_time: page.created_time
  };
}
