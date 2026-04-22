import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export default async function list(): Promise<any> {
  const { stdout } = await execFileAsync('imagesnap', ['-l']).catch(() => ({ stdout: '' }));

  const devices = stdout.trim().split('\n').filter(line => line.includes('Video Device'));

  return {
    success: true,
    count: devices.length,
    devices: devices.map(d => d.replace(/Video Device\[/, '').replace(/\]/, '').trim())
  };
}
