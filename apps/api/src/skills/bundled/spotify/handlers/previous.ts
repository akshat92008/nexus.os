import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export default async function previous(): Promise<any> {
  await execFileAsync('osascript', ['-e', 'tell application "Spotify" to previous track']);
  return { success: true, previous: true };
}
