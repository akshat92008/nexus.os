import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export default async function focus(params: { app: string }): Promise<any> {
  const { app } = params;

  const script = `tell application "${app}" to activate`;

  await execFileAsync('osascript', ['-e', script]);

  return { success: true, app, focused: true };
}
