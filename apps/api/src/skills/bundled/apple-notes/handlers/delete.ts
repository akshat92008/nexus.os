import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export default async function del(params: { title: string; folder?: string }): Promise<any> {
  const { title, folder = 'Notes' } = params;

  const script = `tell application "Notes"
    tell account "iCloud"
      tell folder "${folder}"
        delete (first note whose name is "${title}")
      end tell
    end tell
  end tell`;

  await execFileAsync('osascript', ['-e', script]);

  return { success: true, deleted: true, title, folder };
}
