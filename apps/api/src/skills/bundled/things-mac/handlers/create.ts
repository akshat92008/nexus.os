import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export default async function create(params: { title: string; list?: string; notes?: string; due_date?: string; tag?: string; project?: string }): Promise<any> {
  const { title, list, notes, due_date, tag, project } = params;

  let script = `tell application "Things3"
    set newTodo to make new to do with properties { name:"${title}" }`;

  if (notes) script += `\n    set notes of newTodo to "${notes.replace(/"/g, '\\"')}"`;
  if (due_date) script += `\n    set due date of newTodo to date "${due_date}"`;

  if (list) {
    script += `\n    if "${list}" is "Inbox" then move newTodo to inbox
    else if "${list}" is "Today" then move newTodo to list "Today"
    else if "${list}" is "Upcoming" then move newTodo to list "Upcoming"
    else if "${list}" is "Someday" then move newTodo to list "Someday"
    else if "${list}" is "Anytime" then move newTodo to list "Anytime"
    else if "${list}" is "Logbook" then move newTodo to list "Logbook"
    else move newTodo to area "${list}"`;
  }

  if (tag) script += `\n    assign tag "${tag}" to newTodo`;
  if (project) script += `\n    assign project "${project}" to newTodo`;

  script += `\n  end tell`;

  await execFileAsync('osascript', ['-e', script]);

  return { success: true, title, list: list || 'Inbox' };
}
