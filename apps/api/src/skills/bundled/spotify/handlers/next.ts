import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export default async function next(): Promise<any> {
  await execFileAsync('osascript', ['-e', 'tell application "Spotify" to next track']);
  return { success: true, skipped: true };
}
