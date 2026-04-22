import axios from 'axios';
import * as cheerio from 'cheerio';

export default async function fetchPage(
  params: { url: string; extract_text?: boolean },
  _context: { config: Record<string, any> }
): Promise<{ url: string; title: string; content: string; links: string[] }> {
  const { url, extract_text = true } = params;

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 15000,
      maxRedirects: 5
    });

    const $ = cheerio.load(response.data);
    const title = $('title').text().trim() || 'No title';

    // Remove script and style elements
    $('script, style, nav, footer, header, aside, .advertisement').remove();

    let content: string;
    if (extract_text) {
      content = $('article, main, .content, #content, .post, .entry')
        .first()
        .text()
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 50000); // Limit to 50KB

      if (!content) {
        content = $('body').text().trim().replace(/\s+/g, ' ').slice(0, 50000);
      }
    } else {
      content = response.data;
    }

    // Extract links
    const links: string[] = [];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (href && href.startsWith('http')) {
        links.push(href);
      }
    });

    return { url, title, content, links: links.slice(0, 50) };
  } catch (err) {
    throw new Error(`Failed to fetch ${url}: ${(err as Error).message}`);
  }
}
