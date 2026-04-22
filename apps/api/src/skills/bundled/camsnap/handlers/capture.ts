import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execFileAsync = promisify(execFile);

export default async function capture(params: { output_path?: string; device?: string }): Promise<any> {
  const outPath = params.output_path || path.join('/tmp', `capture-${Date.now()}.jpg`);

  // Use imagesnap for macOS camera capture
  // Install: brew install imagesnap
  await execFileAsync('imagesnap', ['-w', '1', outPath]);

  return {
    success: true,
    output_path: outPath,
    device: params.device || 'default'
  };
}
