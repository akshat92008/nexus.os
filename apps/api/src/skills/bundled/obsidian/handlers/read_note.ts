import { promises as fs } from 'fs';
import path from 'path';

export default async function readNote(params: { vault_path: string; note_path: string }): Promise<any> {
  const { vault_path, note_path } = params;
  const fullPath = path.join(vault_path, note_path);

  // Security: ensure path stays within vault
  const resolvedPath = path.resolve(fullPath);
  const resolvedVault = path.resolve(vault_path);
  if (!resolvedPath.startsWith(resolvedVault)) {
    throw new Error('Note path must be within vault directory');
  }

  const content = await fs.readFile(fullPath, 'utf-8');

  // Extract frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
  const frontmatter = frontmatterMatch ? parseFrontmatter(frontmatterMatch[1]) : {};
  const body = frontmatterMatch ? content.slice(frontmatterMatch[0].length) : content;

  // Extract links
  const wikiLinks = [...body.matchAll(/\[\[([^\]]+)\]\]/g)].map(m => m[1]);
  const mdLinks = [...body.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)].map(m => ({ text: m[1], url: m[2] }));

  return {
    success: true,
    path: note_path,
    title: path.basename(note_path, '.md'),
    frontmatter,
    body: body.slice(0, 50000),
    word_count: body.split(/\s+/).length,
    wiki_links: [...new Set(wikiLinks)],
    markdown_links: mdLinks,
    tags: frontmatter.tags || []
  };
}

function parseFrontmatter(text: string): Record<string, any> {
  const result: Record<string, any> = {};
  const lines = text.split('\n');
  for (const line of lines) {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match) {
      const [, key, value] = match;
      result[key] = value.startsWith('[') ? value.slice(1, -1).split(',').map(s => s.trim()) : value;
    }
  }
  return result;
}
