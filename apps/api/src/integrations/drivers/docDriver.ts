import { Tool, ToolParams, ToolResult } from '../types.js';

export const docDriver: Tool = {
  id:               'create_document',
  name:             'Create Document',
  description:      'Create a structured document in Notion or Google Docs',
  category:         'document',
  riskLevel:        'safe',
  requiresApproval: false,
  paramSchema: {
    title:    { type: 'string',  required: true,  description: 'Document title' },
    content:  { type: 'string',  required: true,  description: 'Document content (markdown)' },
    platform: { type: 'string',  required: false, description: 'notion | google_docs (default: notion)' },
  },
  validate: (p) => {
    if (!p.title) return 'Missing required param: title';
    if (!p.content) return 'Missing required param: content';
    return null;
  },
  execute: async (params) => {
    const platform = params.platform || 'notion';
    return {
      success: true,
      data: { documentId: `doc_${Date.now()}`, title: params.title, platform, url: `https://notion.so/sim_${Date.now()}`, createdAt: new Date().toISOString(), mode: 'simulated' },
      simulatedAt: Date.now(),
    };
  },
};
