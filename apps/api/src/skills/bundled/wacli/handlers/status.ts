import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export default async function status(): Promise<any> {
  const { stdout: device } = await execFileAsync('networksetup', ['-getairportpower', 'en0']);
  const { stdout: info } = await execFileAsync('networksetup', ['-getairportnetwork', 'en0']);
  const { stdout: ipInfo } = await execFileAsync('ipconfig', ['getifaddr', 'en0']).catch(() => ({ stdout: '' }));

  const power = device.includes('On') ? 'on' : 'off';
  const ssidMatch = info.match(/Current Wi-Fi Network: (.+)/);
  const ssid = ssidMatch ? ssidMatch[1].trim() : null;

  return {
    success: true,
    power,
    ssid,
    ip: ipInfo.stdout.trim() || null,
    interface: 'en0'
  };
}
