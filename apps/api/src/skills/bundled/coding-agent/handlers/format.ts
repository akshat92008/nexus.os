import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export default async function format(params: { path: string; formatter?: string }): Promise<any> {
  const { path: targetPath, formatter = 'prettier' } = params;

  let cmd: string, args: string[];

  switch (formatter) {
    case 'prettier':
      cmd = 'npx'; args = ['prettier', '--write', targetPath];
      break;
    case 'black':
      cmd = 'python3'; args = ['-m', 'black', targetPath];
      break;
    case 'gofmt':
      cmd = 'gofmt'; args = ['-w', targetPath];
      break;
    default:
      throw new Error(`Unknown formatter: ${formatter}`);
  }

  await execFileAsync(cmd, args, { cwd: process.cwd() });

  return { success: true, formatter, path: targetPath, formatted: true };
}
