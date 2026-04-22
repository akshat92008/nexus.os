import { promises as fs } from 'fs';
import path from 'path';

export default async function writeNote(params: { vault_path: string; note_path: string; content: string }): Promise<any> {
  const { vault_path, note_path, content } = params;
  const fullPath = path.join(vault_path, note_path);

  // Security: ensure path stays within vault
  const resolvedPath = path.resolve(fullPath);
  const resolvedVault = path.resolve(vault_path);
  if (!resolvedPath.startsWith(resolvedVault)) {
    throw new Error('Note path must be within vault directory');
  }

  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, content, 'utf-8');

  return {
    success: true,
    path: note_path,
    bytes: Buffer.byteLength(content, 'utf-8')
  };
}
