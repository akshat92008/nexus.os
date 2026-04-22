import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export default async function list(params: { list?: string; limit?: number }): Promise<any> {
  const { list = 'Inbox', limit = 20 } = params;

  const script = `tell application "Things3"
    set todoList to {}
    set targetList to list "${list}"
    set allTodos to to dos of targetList
    set countTodos to count of allTodos
    if countTodos > ${limit} then set countTodos to ${limit}
    repeat with i from 1 to countTodos
      set t to item i of allTodos
      set end of todoList to (name of t) & "|" & (status of t as string)
    end repeat
    return todoList as string
  end tell`;

  const { stdout } = await execFileAsync('osascript', ['-e', script]);

  const tasks = stdout.trim()
    .split(', ')
    .map(s => {
      const parts = s.split('|');
      return { title: parts[0]?.trim(), status: parts[1]?.trim() };
    })
    .filter(t => t.title);

  return { success: true, list, count: tasks.length, tasks };
}
