import { promises as fs } from 'fs';
import path from 'path';

function validatePath(filePath: string, allowedPaths: string[]): string {
  const resolved = path.resolve(filePath);
  for (const allowed of allowedPaths) {
    const allowedResolved = path.resolve(allowed);
    if (resolved.startsWith(allowedResolved)) {
      return resolved;
    }
  }
  throw new Error(`Access denied: ${filePath} is outside allowed paths`);
}

export default async function readFile(
  params: { path: string; encoding?: string },
  context: { config: Record<string, any> }
): Promise<{ path: string; content: string; size: number }> {
  const allowedPaths = context.config.allowed_paths || ['./workspace'];
  const resolvedPath = validatePath(params.path, allowedPaths);

  const encoding = (params.encoding || 'utf-8') as BufferEncoding;
  const content = await fs.readFile(resolvedPath, encoding);
  const stats = await fs.stat(resolvedPath);

  return {
    path: params.path,
    content,
    size: stats.size
  };
}
