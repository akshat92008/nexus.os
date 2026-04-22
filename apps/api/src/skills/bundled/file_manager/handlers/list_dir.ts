import { promises as fs } from 'fs';
import path from 'path';

function validatePath(dirPath: string, allowedPaths: string[]): string {
  const resolved = path.resolve(dirPath);
  for (const allowed of allowedPaths) {
    const allowedResolved = path.resolve(allowed);
    if (resolved.startsWith(allowedResolved)) {
      return resolved;
    }
  }
  throw new Error(`Access denied: ${dirPath} is outside allowed paths`);
}

export default async function listDir(
  params: { path: string },
  context: { config: Record<string, any> }
): Promise<{ path: string; entries: Array<{ name: string; type: string; size: number; modified: string }> }> {
  const allowedPaths = context.config.allowed_paths || ['./workspace'];
  const resolvedPath = validatePath(params.path, allowedPaths);

  const entries = await fs.readdir(resolvedPath, { withFileTypes: true });

  const results = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(resolvedPath, entry.name);
      const stats = await fs.stat(fullPath);
      return {
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
        size: stats.size,
        modified: stats.mtime.toISOString()
      };
    })
  );

  return {
    path: params.path,
    entries: results
  };
}
