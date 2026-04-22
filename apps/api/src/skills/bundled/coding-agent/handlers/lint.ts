import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execFileAsync = promisify(execFile);

export default async function lint(params: { path: string; linter?: string; fix?: boolean }): Promise<any> {
  const { path: targetPath, linter = 'eslint', fix = false } = params;

  let cmd: string, args: string[];

  switch (linter) {
    case 'eslint':
      cmd = 'npx'; args = ['eslint', targetPath, '--format', 'json'];
      if (fix) args.push('--fix');
      break;
    case 'prettier':
      cmd = 'npx'; args = ['prettier', '--check', targetPath];
      if (fix) args = ['prettier', '--write', targetPath];
      break;
    case 'flake8':
      cmd = 'python3'; args = ['-m', 'flake8', targetPath, '--format=json'];
      break;
    case 'shellcheck':
      cmd = 'shellcheck'; args = ['--format=json', targetPath];
      break;
    default:
      throw new Error(`Unknown linter: ${linter}`);
  }

  try {
    const { stdout, stderr } = await execFileAsync(cmd, args, { cwd: process.cwd(), env: { ...process.env } });

    let issues: any[] = [];
    try {
      issues = JSON.parse(stdout);
    } catch {
      // Not JSON output
    }

    return {
      success: true,
      linter,
      path: targetPath,
      issues: Array.isArray(issues) ? issues.length : 0,
      details: Array.isArray(issues) ? issues : stdout || stderr
    };
  } catch (err: any) {
    // Linters exit with non-zero when issues found
    let issues: any[] = [];
    try {
      issues = JSON.parse(err.stdout || '[]');
    } catch {
      // Not JSON
    }

    return {
      success: true,
      linter,
      path: targetPath,
      issues: Array.isArray(issues) ? issues.length : 1,
      has_issues: true,
      details: Array.isArray(issues) ? issues : (err.stdout || err.stderr || err.message)
    };
  }
}
