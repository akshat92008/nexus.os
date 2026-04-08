import { Tool } from '../types.js';

export const searchDriver: Tool = {
  id: 'web_search',
  name: 'Web Search',
  description: 'Real-time web search via Serper.dev',
  category: 'data',
  riskLevel: 'safe',
  requiresApproval: false,
  paramSchema: {
    query: { type: 'string', required: true, description: 'Search query' },
    limit: { type: 'number', required: false, description: 'Max results (default 5)' },
  },
  validate: (p) => p.query ? null : 'Missing required param: query',
  execute: async (params) => {
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) throw new Error('SERPER_API_KEY not set');

    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({
        q: params.query,
        num: params.limit ?? 5,
      }),
    });
    
    if (!res.ok) throw new Error(`Serper.dev ${res.status}: ${await res.text()}`);
    
    const data = await res.json() as any;
    
    return {
      success: true,
      data: {
        query: params.query,
        results: (data.organic ?? []).map((r: any) => ({
          title: r.title,
          url: r.link,
          snippet: r.snippet,
          score: r.score ?? 0,
        })),
      },
    };
  },
};
