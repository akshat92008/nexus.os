import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export default async function capture(params: { session?: string; lines?: number }): Promise<any> {
  const { session, lines = 100 } = params;

  if (session) {
    const { stdout } = await execFileAsync('tmux', ['capture-pane', '-t', session, '-p', '-S', `-${lines}`]);
    return { success: true, session, lines: lines, content: stdout };
  }

  // Try to get terminal scrollback via AppleScript (limited)
  try {
    const { stdout } = await execFileAsync('osascript', ['-e',
      `tell application "Terminal"
        set win to front window
        set allText to contents of tab 1 of win
        return allText
      end tell`
    ]);
    const content = stdout.split('\n').slice(-lines).join('\n');
    return { success: true, lines, content, source: 'Terminal' };
  } catch {
    return { success: true, lines, content: '', note: 'No active terminal session found. Use tmux for persistent sessions.' };
  }
}
