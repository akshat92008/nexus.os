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

export default async function writeFile(
  params: { path: string; content: string; encoding?: string },
  context: { config: Record<string, any> }
): Promise<{ path: string; bytes_written: number; success: boolean }> {
  const allowedPaths = context.config.allowed_paths || ['./workspace'];
  const resolvedPath = validatePath(params.path, allowedPaths);

  const encoding = (params.encoding || 'utf-8') as BufferEncoding;
  
  await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
  await fs.writeFile(resolvedPath, params.content, encoding);

  return {
    path: params.path,
    bytes_written: Buffer.byteLength(params.content, encoding),
    success: true
  };
}
