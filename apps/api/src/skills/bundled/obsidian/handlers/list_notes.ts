import { promises as fs } from 'fs';
import path from 'path';

interface NoteEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

export default async function listNotes(params: { vault_path: string; folder?: string }): Promise<any> {
  const { vault_path, folder } = params;
  const targetDir = folder ? path.join(vault_path, folder) : vault_path;

  const entries = await fs.readdir(targetDir, { withFileTypes: true });

  const notes: NoteEntry[] = entries
    .filter(e => !e.name.startsWith('.') && !e.name.startsWith('_'))
    .map(e => ({
      name: e.name,
      path: folder ? path.join(folder, e.name) : e.name,
      isDirectory: e.isDirectory()
    }));

  const mdFiles = notes.filter(n => n.name.endsWith('.md'));
  const folders = notes.filter(n => n.isDirectory);

  return {
    success: true,
    vault: vault_path,
    folder: folder || '/',
    total: notes.length,
    markdown_files: mdFiles.length,
    folders: folders.length,
    items: notes
  };
}
