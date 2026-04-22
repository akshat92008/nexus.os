import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export default async function create(params: { title: string; body: string; folder?: string }): Promise<any> {
  const { title, body, folder = 'Notes' } = params;

  const script = `tell application "Notes"
    tell account "iCloud"
      tell folder "${folder}"
        make new note with properties { name:"${title}", body:"${body.replace(/"/g, '\\"').replace(/\n/g, '\\n')}" }
      end tell
    end tell
  end tell`;

  await execFileAsync('osascript', ['-e', script]);

  return { success: true, title, folder };
}
