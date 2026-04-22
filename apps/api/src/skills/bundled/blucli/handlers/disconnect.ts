import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export default async function disconnect(params: { device: string }): Promise<any> {
  await execFileAsync('bluetoothctl', ['disconnect', params.device]);
  return { success: true, device: params.device, disconnected: true };
}
