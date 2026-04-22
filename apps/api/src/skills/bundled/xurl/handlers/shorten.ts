export default async function shorten(params: { url: string }): Promise<any> {
  const { url } = params;

  const response = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`);
  const shortUrl = await response.text();

  if (!shortUrl || !shortUrl.startsWith('http')) {
    throw new Error('URL shortening failed');
  }

  return { success: true, original: url, short: shortUrl };
}
