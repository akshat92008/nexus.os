import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export default async function volume(params: { level: number }): Promise<any> {
  const level = Math.max(0, Math.min(100, params.level));
  await execFileAsync('osascript', ['-e', `tell application "Spotify" to set sound volume to ${level}`]);
  return { success: true, volume: level };
}
