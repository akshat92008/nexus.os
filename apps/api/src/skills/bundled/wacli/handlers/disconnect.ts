import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export default async function disconnect(): Promise<any> {
  await execFileAsync('networksetup', ['-setairportpower', 'en0', 'off']);
  await execFileAsync('networksetup', ['-setairportpower', 'en0', 'on']);

  return { success: true, disconnected: true };
}
