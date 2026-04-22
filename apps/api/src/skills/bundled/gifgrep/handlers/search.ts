export default async function search(params: { query: string; limit?: number; provider?: string }): Promise<any> {
  const { query, limit = 10, provider = 'tenor' } = params;

  if (provider === 'tenor') {
    // Free public search (no API key required for limited usage)
    const response = await fetch(`https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${process.env.TENOR_API_KEY || 'AIzaSyAyIMoK8mE2XeR5S3IOy8Gl_F5AWX3ayjI'}&limit=${limit}`);
    const data = await response.json();

    return {
      success: true,
      provider: 'tenor',
      query,
      results: data.results?.map((r: any) => ({
        id: r.id,
        url: r.media_formats?.gif?.url || r.url,
        preview: r.media_formats?.tinygif?.url,
        title: r.content_description
      })) || []
    };
  }

  throw new Error(`Provider ${provider} not yet supported`);
}
