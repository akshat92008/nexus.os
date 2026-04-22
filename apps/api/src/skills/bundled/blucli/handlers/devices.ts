import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export default async function devices(): Promise<any> {
  const { stdout } = await execFileAsync('bluetoothctl', ['devices']);

  const deviceList = stdout.trim().split('\n').map(line => {
    const match = line.match(/Device ([0-9A-F:]{17}) (.+)/);
    if (!match) return null;
    return {
      mac: match[1],
      name: match[2]?.trim()
    };
  }).filter(Boolean);

  return { success: true, count: deviceList.length, devices: deviceList };
}
