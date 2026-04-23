import { randomUUID } from 'crypto';
import { readFile, writeFile, readdir, stat, mkdir } from 'fs/promises';
import { join, relative, dirname } from 'path';

export class ObsidianDriver {
  private vaultPath: string;
  constructor(vaultPath?: string) {
    this.vaultPath = vaultPath || process.env.OBSIDIAN_VAULT_PATH || './vault';
  }

  private resolve(p: string): string { return join(this.vaultPath, p.replace(/^\//, '')); }

  async list(folder = ''): Promise<{ name: string; path: string; isDir: boolean; mtime: Date }[]> {
    const dir = this.resolve(folder);
    const items = await readdir(dir, { withFileTypes: true });
    return Promise.all(items.map(async (d) => {
      const p = join(dir, d.name);
      const s = await stat(p);
      return { name: d.name, path: relative(this.vaultPath, p), isDir: d.isDirectory(), mtime: s.mtime };
    }));
  }

  async read(path: string): Promise<{ content: string; frontmatter: Record<string, any> }> {
    const raw = await readFile(this.resolve(path), 'utf-8');
    const fm: Record<string, any> = {};
    const m = raw.match(/^---\n([\s\S]*?)\n---/);
    if (m) {
      for (const line of m[1].split('\n')) {
        const [k, ...v] = line.split(':'); if (k) fm[k.trim()] = v.join(':').trim();
      }
    }
    return { content: raw.replace(/^---\n[\s\S]*?\n---\n?/, '').trim(), frontmatter: fm };
  }

  async write(path: string, content: string, frontmatter?: Record<string, any>): Promise<void> {
    const p = this.resolve(path);
    await mkdir(dirname(p), { recursive: true });
    let out = '';
    if (frontmatter && Object.keys(frontmatter).length) {
      out += '---\n' + Object.entries(frontmatter).map(([k, v]) => `${k}: ${v}`).join('\n') + '\n---\n\n';
    }
    out += content;
    await writeFile(p, out, 'utf-8');
  }

  async search(q: string): Promise<{ path: string; matches: string[] }[]> {
    const results: { path: string; matches: string[] }[] = [];
    const walk = async (dir: string) => {
      const items = await readdir(dir, { withFileTypes: true });
      for (const d of items) {
        const p = join(dir, d.name);
        if (d.isDirectory()) await walk(p);
        else if (d.name.endsWith('.md')) {
          const text = await readFile(p, 'utf-8');
          const lines = text.split('\n').filter(l => l.toLowerCase().includes(q.toLowerCase()));
          if (lines.length) results.push({ path: relative(this.vaultPath, p), matches: lines.slice(0, 5) });
        }
      }
    };
    await walk(this.vaultPath);
    return results;
  }
}
