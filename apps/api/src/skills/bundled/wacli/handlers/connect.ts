import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export default async function connect(params: { ssid: string; password?: string }): Promise<any> {
  const { ssid, password } = params;

  const args = password
    ? ['-setairportnetwork', 'en0', ssid, password]
    : ['-setairportnetwork', 'en0', ssid];

  const { stdout } = await execFileAsync('networksetup', args);

  return {
    success: true,
    ssid,
    message: stdout.trim()
  };
}
