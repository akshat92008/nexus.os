import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export default async function complete(params: { name: string; list?: string }): Promise<any> {
  const { name, list = 'Reminders' } = params;

  const script = `tell application "Reminders"
    tell list "${list}"
      set r to first reminder whose name is "${name}"
      set completed of r to true
    end tell
  end tell`;

  await execFileAsync('osascript', ['-e', script]);

  return { success: true, completed: true, name, list };
}
