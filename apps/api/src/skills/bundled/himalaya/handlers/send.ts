import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import path from 'path';
import os from 'os';

const execFileAsync = promisify(execFile);

export default async function send(params: { to: string; subject: string; body: string }): Promise<any> {
  const { to, subject, body } = params;
  const tmpFile = path.join(os.tmpdir(), `email-${Date.now()}.eml`);

  await writeFile(tmpFile, `To: ${to}\nSubject: ${subject}\n\n${body}`, 'utf-8');

  try {
    await execFileAsync('himalaya', ['send', tmpFile]);
    await unlink(tmpFile).catch(() => {});

    return { success: true, to, subject, sent: true };
  } catch (err: any) {
    await unlink(tmpFile).catch(() => {});
    throw new Error(`Email send failed: ${err.message}`);
  }
}
