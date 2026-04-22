export default async function fetchPage(params: { url: string; format?: string; headers?: Record<string, string>; timeout?: number }): Promise<any> {
  const { url, format = 'text', headers, timeout = 15000 } = params;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        ...headers
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    let content: string;
    const contentType = response.headers.get('content-type') || '';

    if (format === 'json' && contentType.includes('application/json')) {
      const data = await response.json();
      return { success: true, url, format, data };
    }

    content = await response.text();

    if (format === 'text') {
      // Strip HTML tags for plain text
      const text = content
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return { success: true, url, format, text: text.slice(0, 50000), length: text.length };
    }

    if (format === 'markdown') {
      // Simple HTML-to-Markdown conversion
      let md = content
        .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
        .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
        .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
        .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
        .replace(/<a[^>]+href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
        .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
        .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
        .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
        .replace(/<pre[^>]*>(.*?)<\/pre>/gis, '```\n$1\n```')
        .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
        .replace(/<[^>]+>/g, '');
      return { success: true, url, format, markdown: md.slice(0, 50000) };
    }

    // HTML
    return { success: true, url, format, html: content.slice(0, 50000), length: content.length };
  } catch (err: any) {
    clearTimeout(timeoutId);
    throw new Error(`Fetch failed: ${err.message}`);
  }
}
