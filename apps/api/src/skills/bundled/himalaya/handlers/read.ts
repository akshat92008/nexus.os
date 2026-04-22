import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export default async function read(params: { id: string; folder?: string }): Promise<any> {
  const { id, folder = 'INBOX' } = params;

  try {
    const { stdout } = await execFileAsync('himalaya', [
      'read', id,
      '--folder', folder,
      '--json'
    ]);

    const email = JSON.parse(stdout);

    return {
      success: true,
      id,
      folder,
      from: email.from,
      to: email.to,
      subject: email.subject,
      date: email.date,
      body: email.textBody || email.htmlBody || ''
    };
  } catch (err: any) {
    throw new Error(`Email read failed: ${err.message}`);
  }
}
