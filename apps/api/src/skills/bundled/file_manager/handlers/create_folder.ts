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

export default async function createFolder(
  params: { path: string },
  context: { config: Record<string, any> }
): Promise<{ path: string; created: boolean }> {
  const allowedPaths = context.config.allowed_paths || ['./workspace'];
  const resolvedPath = validatePath(params.path, allowedPaths);

  await fs.mkdir(resolvedPath, { recursive: true });

  return {
    path: params.path,
    created: true
  };
}
