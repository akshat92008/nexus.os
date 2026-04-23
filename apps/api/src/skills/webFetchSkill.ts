import { randomUUID } from 'crypto';

export class WebFetchSkill {
  private cache = new Map<string, { result: FetchResult; ts: number }>();
  private readonly TTL = 5 * 60 * 1000;

  async fetch(url: string, opts?: { maxLen?: number }): Promise<FetchResult> {
    const ck = this.hash(url);
    const cached = this.cache.get(ck);
    if (cached && Date.now() - cached.ts < this.TTL) return cached.result;

    const res = await fetch(url, { headers: { 'User-Agent': 'NexusBot/1.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const result = this.parse(url, html, opts?.maxLen ?? 8000);
    this.cache.set(ck, { result, ts: Date.now() });
    return result;
  }

  private parse(url: string, html: string, maxLen: number): FetchResult {
    const title = html.match(/<title[^>]*>(.*?)<\/title>/i)?.[1]?.trim() || '';
    const text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLen) + (html.length > maxLen ? '... [truncated]' : '');
    const links = Array.from(new Set(Array.from(html.matchAll(/href="(https?:\/\/[^"]+)"/g)).map(m => m[1]))).slice(0, 20);
    const images = Array.from(new Set(Array.from(html.matchAll(/src="(https?:\/\/[^"]+\.(?:jpg|jpeg|png|gif|webp))"/gi)).map(m => m[1]))).slice(0, 10);
    return { url, title, content: text, links, images, metadata: {}, fetchedAt: new Date().toISOString(), cacheKey: this.hash(url) };
  }

  async search(q: string): Promise<{ title: string; url: string; snippet: string }[]> {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = await res.text();
    const out: { title: string; url: string; snippet: string }[] = [];
    const re = /<a[^>]*class="result__a"[^>]*href="\/\/duckduckgo.com\/l\/\?uddg=([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = re.exec(html)) && out.length < 10) {
      try { out.push({ title: m[2].replace(/<[^>]+>/g, ''), url: decodeURIComponent(m[1]), snippet: m[3].replace(/<[^>]+>/g, ' ') }); } catch (e) {}
    }
    return out;
  }

  private hash(u: string): string {
    let h = 0;
    for (let i = 0; i < u.length; i++) h = ((h << 5) - h + u.charCodeAt(i)) | 0;
    return `f_${Math.abs(h).toString(36)}`;
  }
}

export interface FetchResult {
  url: string; title?: string; content: string; links: string[]; images: string[]; metadata: Record<string, any>; fetchedAt: string; cacheKey?: string;
}
