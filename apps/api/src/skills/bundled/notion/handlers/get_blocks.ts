import { notionRequest, formatPageId } from './base.js';

interface GetBlocksParams {
  page_id: string;
}

export default async function getBlocks(params: GetBlocksParams, _context: { config: Record<string, any> }): Promise<any> {
  const { page_id } = params;
  const formattedId = formatPageId(page_id);

  const data = await notionRequest(`/blocks/${formattedId}/children`);

  // Simplify blocks for readability
  const simplified = data.results?.map((block: any) => {
    const base = {
      id: block.id,
      type: block.type,
      has_children: block.has_children
    };

    // Extract text content based on block type
    if (block.type === 'paragraph' && block.paragraph?.rich_text) {
      return { ...base, content: block.paragraph.rich_text.map((t: any) => t.text?.content || '').join('') };
    }
    if (block.type?.startsWith('heading_') && block[block.type]?.rich_text) {
      return { ...base, content: block[block.type].rich_text.map((t: any) => t.text?.content || '').join('') };
    }
    if (block.type === 'bulleted_list_item' && block.bulleted_list_item?.rich_text) {
      return { ...base, content: '• ' + block.bulleted_list_item.rich_text.map((t: any) => t.text?.content || '').join('') };
    }
    if (block.type === 'numbered_list_item' && block.numbered_list_item?.rich_text) {
      return { ...base, content: block.numbered_list_item.rich_text.map((t: any) => t.text?.content || '').join('') };
    }
    if (block.type === 'code' && block.code?.rich_text) {
      return { ...base, content: block.code.rich_text.map((t: any) => t.text?.content || '').join(''), language: block.code.language };
    }

    return base;
  }) || [];

  return {
    success: true,
    page_id: formattedId,
    block_count: data.results?.length || 0,
    blocks: simplified
  };
}
