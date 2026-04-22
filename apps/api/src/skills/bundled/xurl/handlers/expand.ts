export default async function expand(params: { url: string }): Promise<any> {
  const { url } = params;

  const response = await fetch(url, { method: 'HEAD', redirect: 'manual' });
  const location = response.headers.get('location');

  if (location) {
    return { success: true, short: url, expanded: location };
  }

  // Fallback: try GET and follow
  const getResponse = await fetch(url, { redirect: 'follow' });
  return { success: true, short: url, expanded: getResponse.url };
}
