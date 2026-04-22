import { promises as fs } from 'fs';

export default async function search(params: { query: string; log_path: string }): Promise<any> {
  const { query, log_path } = params;
  const content = await fs.readFile(log_path, 'utf-8');
  const lines = content.split('\n');

  const regex = new RegExp(query, 'i');
  const matches = lines
    .map((line, index) => ({ line: line.trim(), index: index + 1 }))
    .filter(item => regex.test(item.line));

  return {
    success: true,
    query,
    matches: matches.length,
    results: matches.slice(0, 50)
  };
}
