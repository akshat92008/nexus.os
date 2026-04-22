import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export default async function list(params: { folder?: string; limit?: number; search?: string }): Promise<any> {
  const { folder = 'Notes', limit = 20, search } = params;

  const script = `tell application "Notes"
    tell account "iCloud"
      tell folder "${folder}"
        set noteList to {}
        set allNotes to notes
        set countNotes to count of allNotes
        if countNotes > ${limit} then set countNotes to ${limit}
        repeat with i from 1 to countNotes
          set n to item i of allNotes
          ${search ? `if "${search}" is in (name of n as string) then` : ''}
          set end of noteList to (name of n) & "|" & (modification date of n as string)
          ${search ? 'end if' : ''}
        end repeat
        return noteList as string
      end tell
    end tell
  end tell`;

  const { stdout } = await execFileAsync('osascript', ['-e', script]);

  const notes = stdout.trim()
    .split(', ')
    .map(s => {
      const parts = s.split('|');
      return { title: parts[0]?.trim(), modified: parts[1]?.trim() };
    })
    .filter(n => n.title);

  return { success: true, folder, count: notes.length, notes };
}
