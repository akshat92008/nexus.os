import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export default async function get(params: { title: string; folder?: string }): Promise<any> {
  const { title, folder = 'Notes' } = params;

  const script = `tell application "Notes"
    tell account "iCloud"
      tell folder "${folder}"
        set noteRef to first note whose name is "${title}"
        return (name of noteRef) & "|||" & (body of noteRef)
      end tell
    end tell
  end tell`;

  const { stdout } = await execFileAsync('osascript', ['-e', script]);
  const parts = stdout.split('|||');

  return {
    success: true,
    title: parts[0]?.trim(),
    body: parts[1]?.trim() || '',
    folder
  };
}
