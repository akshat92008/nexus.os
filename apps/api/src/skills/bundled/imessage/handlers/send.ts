import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export default async function send(params: { to: string; message: string }): Promise<any> {
  const { to, message } = params;

  const script = `tell application "Messages"
    set targetService to 1st service whose service type = iMessage
    set targetBuddy to buddy "${to}" of targetService
    send "${message.replace(/"/g, '\\"')}" to targetBuddy
  end tell`;

  await execFileAsync('osascript', ['-e', script]);

  return { success: true, to, sent: true };
}
