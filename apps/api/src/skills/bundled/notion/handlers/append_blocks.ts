import { notionRequest, formatPageId } from './base.js';

interface AppendBlocksParams {
  page_id: string;
  blocks?: any[];
  content?: string;
}

export default async function appendBlocks(params: AppendBlocksParams, _context: { config: Record<string, any> }): Promise<any> {
  const { page_id, blocks, content } = params;
  const formattedId = formatPageId(page_id);

  let children: any[] = [];

  if (blocks && blocks.length > 0) {
    children = blocks;
  } else if (content) {
    // Simple text content - split into paragraphs
    const paragraphs = content.split('\n\n').map(text => ({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{ type: 'text', text: { content: text.trim() } }]
      }
    }));
    children = paragraphs;
  }

  if (children.length === 0) {
    throw new Error('No blocks or content provided');
  }

  const data = await notionRequest(`/blocks/${formattedId}/children`, {
    method: 'PATCH',
    body: JSON.stringify({ children })
  });

  return {
    success: true,
    page_id: formattedId,
    blocks_appended: children.length,
    results: data.results
  };
}
