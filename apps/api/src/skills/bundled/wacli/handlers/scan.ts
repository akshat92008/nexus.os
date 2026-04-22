import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export default async function scan(): Promise<any> {
  const { stdout } = await execFileAsync('/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport', ['-s']);

  const networks = stdout.trim().split('\n').slice(1).map(line => {
    const parts = line.trim().split(/\s+/);
    return {
      ssid: parts[0],
      bssid: parts[1],
      rssi: parts[2] ? parseInt(parts[2]) : null,
      channel: parts[3] ? parseInt(parts[3]) : null,
      security: parts.slice(4).join(' ') || 'Unknown'
    };
  });

  return { success: true, count: networks.length, networks };
}
