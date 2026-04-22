import axios from 'axios';

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export default async function searchWeb(
  params: { query: string; max_results?: number },
  context: { config: Record<string, any> }
): Promise<{ results: SearchResult[]; query: string; engine: string }> {
  const { query, max_results = 5 } = params;
  const engine = context.config.search_engine || 'duckduckgo';

  let results: SearchResult[] = [];

  switch (engine) {
    case 'duckduckgo':
      results = await searchDuckDuckGo(query, max_results);
      break;
    case 'bing':
      results = await searchBing(query, max_results, context.config);
      break;
    default:
      results = await searchDuckDuckGo(query, max_results);
  }

  return {
    results,
    query,
    engine
  };
}

async function searchDuckDuckGo(query: string, maxResults: number): Promise<SearchResult[]> {
  try {
    const response = await axios.get('https://html.duckduckgo.com/html/', {
      params: { q: query },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    // Parse results from HTML
    const html = response.data;
    const results: SearchResult[] = [];

    // Simple regex-based extraction
    const resultMatches = html.matchAll(/<a rel="nofollow" class="result__a" href="([^"]+)">([^<]+)<\/a>.*?<a class="result__snippet"[^>]*>([^<]+)<\/a>/gs);

    for (const match of resultMatches) {
      if (results.length >= maxResults) break;
      results.push({
        url: match[1],
        title: cleanHtml(match[2]),
        snippet: cleanHtml(match[3] || '')
      });
    }

    return results;
  } catch (err) {
    throw new Error(`DuckDuckGo search failed: ${(err as Error).message}`);
  }
}

async function searchBing(query: string, maxResults: number, config: Record<string, any>): Promise<SearchResult[]> {
  const apiKey = process.env.BING_SEARCH_API_KEY;
  if (!apiKey) {
    throw new Error('BING_SEARCH_API_KEY not configured');
  }

  try {
    const response = await axios.get('https://api.bing.microsoft.com/v7.0/search', {
      params: { q: query, count: maxResults },
      headers: { 'Ocp-Apim-Subscription-Key': apiKey },
      timeout: 10000
    });

    return (response.data.webPages?.value || []).map((item: any) => ({
      title: item.name,
      url: item.url,
      snippet: item.snippet
    }));
  } catch (err) {
    throw new Error(`Bing search failed: ${(err as Error).message}`);
  }
}

function cleanHtml(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, '')
    .trim();
}
