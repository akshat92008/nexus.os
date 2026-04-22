import { promises as fs } from 'fs';
import path from 'path';

interface SearchResult {
  path: string;
  title: string;
  matches: number;
  preview: string;
}

export default async function search(params: { vault_path: string; query: string; limit?: number }): Promise<any> {
  const { vault_path, query, limit = 20 } = params;
  const regex = new RegExp(query, 'gi');

  const results: SearchResult[] = [];

  async function walk(dir: string, relativeDir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name.startsWith('_')) continue;

      const fullPath = path.join(dir, entry.name);
      const relPath = path.join(relativeDir, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath, relPath);
      } else if (entry.name.endsWith('.md')) {
        try {
          const content = await fs.readFile(fullPath, 'utf-8');
          const matches = [...content.matchAll(regex)];

          if (matches.length > 0) {
            const firstMatchIndex = matches[0].index || 0;
            const previewStart = Math.max(0, firstMatchIndex - 80);
            const preview = content.slice(previewStart, previewStart + 200).replace(/\n/g, ' ');

            results.push({
              path: relPath,
              title: path.basename(entry.name, '.md'),
              matches: matches.length,
              preview: `...${preview}...`
            });
          }
        } catch {
          // Skip unreadable files
        }
      }
    }
  }

  await walk(vault_path, '');

  results.sort((a, b) => b.matches - a.matches);

  return {
    success: true,
    query,
    total_matches: results.reduce((sum, r) => sum + r.matches, 0),
    count: results.length,
    results: results.slice(0, limit)
  };
}
