import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export default async function pause(): Promise<any> {
  await execFileAsync('osascript', ['-e', 'tell application "Spotify" to pause']);
  return { success: true, paused: true };
}
