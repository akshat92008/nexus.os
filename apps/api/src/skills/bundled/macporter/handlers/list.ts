import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export default async function list(): Promise<any> {
  const script = `tell application "System Events"
    set appList to {}
    repeat with proc in (get processes whose background only is false)
      set end of appList to (name of proc) & "|" & (frontmost of proc as string)
    end repeat
    return appList as string
  end tell`;

  const { stdout } = await execFileAsync('osascript', ['-e', script]);

  const apps = stdout.trim().split(', ').map(item => {
    const parts = item.split('|');
    return {
      name: parts[0]?.trim(),
      frontmost: parts[1]?.trim() === 'true'
    };
  }).filter(a => a.name);

  return { success: true, count: apps.length, apps };
}
