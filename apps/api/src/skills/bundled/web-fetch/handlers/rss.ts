export default async function fetchRss(params: { url: string; limit?: number }): Promise<any> {
  const { url, limit = 20 } = params;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'application/rss+xml, application/xml, text/xml'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const xml = await response.text();

  // Parse RSS items
  const items: Array<{
    title: string;
    link: string;
    description: string;
    pubDate: string;
    author?: string;
  }> = [];

  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
  for (const match of itemMatches) {
    const itemXml = match[1];
    const title = itemXml.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() || '';
    const link = itemXml.match(/<link>(.*?)<\/link>/)?.[1]?.trim() || '';
    const description = itemXml.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/)?.[1]?.trim() || '';
    const pubDate = itemXml.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]?.trim() || '';
    const author = itemXml.match(/<(?:author|dc:creator)>(.*?)<\/(?:author|dc:creator)>/)?.[1]?.trim() || '';

    if (title) {
      items.push({ title, link, description, pubDate, author });
    }
    if (items.length >= limit) break;
  }

  // If no RSS items found, try Atom
  if (items.length === 0) {
    const entryMatches = xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g);
    for (const match of entryMatches) {
      const entryXml = match[1];
      const title = entryXml.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() || '';
      const link = entryXml.match(/<link[^>]+href="([^"]*)"/)?.[1]?.trim() || '';
      const summary = entryXml.match(/<(?:summary|content)>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:summary|content)>/)?.[1]?.trim() || '';
      const updated = entryXml.match(/<updated>(.*?)<\/updated>/)?.[1]?.trim() || '';
      const author = entryXml.match(/<author>\s*<name>(.*?)<\/name>\s*<\/author>/)?.[1]?.trim() || '';

      if (title) {
        items.push({ title, link, description: summary, pubDate: updated, author });
      }
      if (items.length >= limit) break;
    }
  }

  // Extract feed metadata
  const channelTitle = xml.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() || '';
  const channelLink = xml.match(/<link>(.*?)<\/link>/)?.[1]?.trim() || '';
  const channelDesc = xml.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/)?.[1]?.trim() || '';

  return {
    success: true,
    url,
    feed: {
      title: channelTitle,
      link: channelLink,
      description: channelDesc
    },
    count: items.length,
    items
  };
}
