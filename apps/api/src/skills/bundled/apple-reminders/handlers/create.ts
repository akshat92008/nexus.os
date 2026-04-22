import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export default async function create(params: { name: string; list?: string; due_date?: string; notes?: string; priority?: string }): Promise<any> {
  const { name, list = 'Reminders', due_date, notes } = params;

  let dueScript = '';
  if (due_date) {
    dueScript = `, due date:(date "${due_date}")`;
  }

  let notesScript = '';
  if (notes) {
    notesScript = `, body:"${notes.replace(/"/g, '\\"')}"`;
  }

  const script = `tell application "Reminders"
    tell list "${list}"
      make new reminder with properties { name:"${name}"${dueScript}${notesScript} }
    end tell
  end tell`;

  await execFileAsync('osascript', ['-e', script]);

  return { success: true, name, list };
}
