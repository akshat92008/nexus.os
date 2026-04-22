import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export default async function list(params: { list?: string; completed?: boolean }): Promise<any> {
  const { list = 'Reminders', completed = false } = params;

  const script = `tell application "Reminders"
    tell list "${list}"
      set remList to {}
      repeat with r in (every reminder whose completed is ${completed})
        set end of remList to (name of r) & "|" & (completed of r as string) & "|" & (due date of r as string) & "|" & (body of r)
      end repeat
      return remList as string
    end tell
  end tell`;

  const { stdout } = await execFileAsync('osascript', ['-e', script]);

  const reminders = stdout.trim()
    .split(', ')
    .map(s => {
      const parts = s.split('|');
      return {
        name: parts[0]?.trim(),
        completed: parts[1]?.trim() === 'true',
        due_date: parts[2]?.trim(),
        notes: parts[3]?.trim()
      };
    })
    .filter(r => r.name);

  return { success: true, list, count: reminders.length, reminders };
}
