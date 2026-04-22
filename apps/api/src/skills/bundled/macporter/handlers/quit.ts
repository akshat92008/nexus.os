import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export default async function quit(params: { app: string; force?: boolean }): Promise<any> {
  const { app, force = false } = params;

  const script = force
    ? `tell application "${app}" to quit saving no`
    : `tell application "${app}" to quit`;

  await execFileAsync('osascript', ['-e', script]);

  return { success: true, app, force };
}
