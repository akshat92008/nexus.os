import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export default async function list(params: { folder?: string; limit?: number }): Promise<any> {
  const { folder = 'INBOX', limit = 20 } = params;

  try {
    const { stdout } = await execFileAsync('himalaya', [
      'list', folder,
      '--size', String(limit),
      '--json'
    ]);

    const emails = JSON.parse(stdout);

    return {
      success: true,
      folder,
      count: emails.length,
      emails: emails.map((e: any) => ({
        id: e.id,
        from: e.from?.map((f: any) => f.address)?.join(', '),
        subject: e.subject,
        date: e.date,
        flags: e.flags
      }))
    };
  } catch (err: any) {
    if (err.message?.includes('not found') || err.stderr?.includes('not found')) {
      throw new Error('Himalaya CLI not installed. Install: cargo install himalaya or brew install himalaya');
    }
    throw new Error(`Email list failed: ${err.message}`);
  }
}
