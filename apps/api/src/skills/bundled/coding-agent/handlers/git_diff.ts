import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export default async function gitDiff(params: { path?: string; staged?: boolean }): Promise<any> {
  const { path: targetPath, staged = true } = params;

  const args = staged ? ['diff', '--cached'] : ['diff'];
  if (targetPath) args.push('--', targetPath);

  const { stdout } = await execFileAsync('git', args, { cwd: process.cwd() });

  const added = (stdout.match(/^\+[^+]/gm) || []).length;
  const removed = (stdout.match(/^-[^-]/gm) || []).length;
  const files = [...stdout.matchAll(/^diff --git a\/(.+) b\/(.+)/gm)].map(m => m[1]);

  return {
    success: true,
    path: targetPath || 'all',
    staged,
    filesChanged: [...new Set(files)],
    linesAdded: added,
    linesRemoved: removed,
    diff: stdout.slice(0, 50000) // Limit output
  };
}
