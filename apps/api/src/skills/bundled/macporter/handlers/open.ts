import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export default async function open(params: { app: string; file?: string; activate?: boolean }): Promise<any> {
  const { app, file, activate = true } = params;

  let script: string;

  if (file) {
    script = `tell application "${app}" to open POSIX file "${file}"`;
    if (activate) {
      script += `\ntell application "${app}" to activate`;
    }
  } else {
    script = `tell application "${app}" to activate`;
  }

  await execFileAsync('osascript', ['-e', script]);

  return { success: true, app, file, activated: activate };
}
