import { Tool } from '../types.js';

export const searchDriver: Tool = {
  id: 'web_search',
  name: 'Web Search',
  description: 'Real-time web search via Tavily API',
  category: 'data',
  riskLevel: 'safe',
  requiresApproval: false,
  paramSchema: {
    query: { type: 'string', required: true, description: 'Search query' },
    limit: { type: 'number', required: false, description: 'Max results (default 5)' },
  },
  validate: (p) => p.query ? null : 'Missing required param: query',
  execute: async (params) => {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) throw new Error('TAVILY_API_KEY not set');

    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: params.query,
        max_results: params.limit ?? 5,
        search_depth: "smart",
        include_images: false,
        include_answer: true,
        include_raw_content: false,
        include_domains: [],
        exclude_domains: []
      }),
    });
    
    if (!res.ok) throw new Error(`Tavily API ${res.status}: ${await res.text()}`);
    
    const data = await res.json() as any;
    
    return {
      success: true,
      data: {
        query: params.query,
        answer: data.answer,
        results: (data.results ?? []).map((r: any) => ({
          title: r.title,
          url: r.url,
          snippet: r.content,
          score: r.score ?? 0,
        })),
      },
    };
  },
};
