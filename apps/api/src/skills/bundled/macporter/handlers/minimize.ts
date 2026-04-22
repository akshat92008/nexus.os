import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export default async function minimize(params: { app: string }): Promise<any> {
  const { app } = params;

  const script = `tell application "System Events"
    tell application process "${app}"
      set value of attribute "AXMinimized" of window 1 to true
    end tell
  end tell`;

  await execFileAsync('osascript', ['-e', script]);

  return { success: true, app, minimized: true };
}
