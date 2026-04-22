import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export default async function complete(params: { title: string }): Promise<any> {
  const { title } = params;

  const script = `tell application "Things3"
    repeat with t in (every to do whose name is "${title}" and status is not completed)
      set status of t to completed
    end repeat
  end tell`;

  await execFileAsync('osascript', ['-e', script]);

  return { success: true, completed: true, title };
}
