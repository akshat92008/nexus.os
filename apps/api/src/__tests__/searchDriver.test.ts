import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchDriver } from '../integrations/drivers/searchDriver.js';

describe('Search Driver — Tavily', () => {
  beforeEach(() => {
    process.env.TAVILY_API_KEY = 'test-api-key';
    vi.stubGlobal('fetch', vi.fn());
    vi.clearAllMocks();
  });

  it('Happy Path: returns formatted results on valid query', async () => {
    const mockTavilyResponse = {
      results: [
        { title: 'Nexus OS', url: 'https://nexus.os', content: 'The AI Operating System', score: 0.99 },
        { title: 'Nexus API', url: 'https://nexus.os/api', content: 'RESTful Agent Interface', score: 0.85 },
      ],
    };

    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockTavilyResponse,
    });

    const result = await searchDriver.execute({ query: 'Nexus OS', limit: 2 });

    expect(fetch).toHaveBeenCalledWith('https://api.tavily.com/search', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('"query":"Nexus OS"'),
    }));

    expect(result.success).toBe(true);
    expect(result.data.results).toHaveLength(2);
    expect(result.data.results[0]).toEqual({
      title: 'Nexus OS',
      url: 'https://nexus.os',
      snippet: 'The AI Operating System',
      score: 0.99,
    });
  });

  it('Error Path: throws if TAVILY_API_KEY is not set', async () => {
    delete process.env.TAVILY_API_KEY;

    await expect(searchDriver.execute({ query: 'test' }))
      .rejects.toThrow('TAVILY_API_KEY not set');
  });

  it('Error Path: throws on HTTP error from Tavily', async () => {
    (fetch as any).mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'Rate limit exceeded',
    });

    await expect(searchDriver.execute({ query: 'test' }))
      .rejects.toThrow('Tavily 429: Rate limit exceeded');
  });

  it('Validation Path: returns error string if query is missing', () => {
    const error = searchDriver.validate({});
    expect(error).toBe('Missing required param: query');

    const valid = searchDriver.validate({ query: 'hello' });
    expect(valid).toBe(null);
  });
});
