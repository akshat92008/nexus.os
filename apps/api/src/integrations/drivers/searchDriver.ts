import { Tool, ToolParams, ToolResult } from '../types.js';

export const searchDriver: Tool = {
  id:               'web_search',
  name:             'Web Search',
  description:      'Execute a real-time web search for current information',
  category:         'data',
  riskLevel:        'safe',
  requiresApproval: false,
  paramSchema: {
    query: { type: 'string', required: true, description: 'Search query' },
    limit: { type: 'number', required: false, description: 'Max results (default 5)' },
  },
  validate: (p) => {
    if (!p.query) return 'Missing required param: query';
    return null;
  },
  execute: async (params) => {
    return {
      success: true,
      data: {
        query: params.query,
        results: [
          { title: 'Simulated Result 1', url: 'https://example.com/1', snippet: 'Simulated search result for ' + params.query },
          { title: 'Simulated Result 2', url: 'https://example.com/2', snippet: 'Another simulated result' },
        ],
        mode: 'simulated',
      },
      simulatedAt: Date.now(),
    };
  },
};
