import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export default async function connect(params: { device: string }): Promise<any> {
  await execFileAsync('bluetoothctl', ['connect', params.device]);
  return { success: true, device: params.device, connected: true };
}
