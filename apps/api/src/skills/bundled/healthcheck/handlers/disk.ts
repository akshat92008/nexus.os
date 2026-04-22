import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export default async function disk(): Promise<any> {
  const { stdout } = await execFileAsync('df', ['-h']);

  const lines = stdout.trim().split('\n').slice(1);
  const volumes = lines.map(line => {
    const parts = line.trim().split(/\s+/);
    return {
      filesystem: parts[0] || '',
      size: parts[1] || '',
      used: parts[2] || '',
      available: parts[3] || '',
      capacity: parts[4]?.replace('%', '') || '0',
      mounted_on: parts.slice(5).join(' ') || ''
    };
  });

  return {
    success: true,
    volumes
  };
}
