import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

interface IssueCreateParams {
  repo: string;
  title: string;
  body?: string;
  labels?: string[];
}

export default async function issueCreate(params: IssueCreateParams, _context: { config: Record<string, any> }): Promise<any> {
  const { repo, title, body, labels } = params;

  const args = [
    'issue', 'create',
    '--repo', repo,
    '--title', title
  ];

  if (body) {
    args.push('--body', body);
  }

  if (labels && labels.length > 0) {
    args.push('--label', labels.join(','));
  }

  try {
    const { stdout } = await execFileAsync('gh', args, { env: { ...process.env } });

    // Parse issue URL from output
    const urlMatch = stdout.match(/https:\/\/github\.com\/[^\s]+/);
    const url = urlMatch ? urlMatch[0] : null;
    const numberMatch = url?.match(/\/(\d+)$/);
    const number = numberMatch ? parseInt(numberMatch[1]) : null;

    return {
      success: true,
      repo,
      number,
      url,
      title
    };
  } catch (err: any) {
    throw new Error(`Failed to create issue: ${err.message}`);
  }
}
