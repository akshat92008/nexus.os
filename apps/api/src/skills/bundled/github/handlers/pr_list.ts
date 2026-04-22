import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

interface PRListParams {
  repo: string;
  state?: 'open' | 'closed' | 'merged' | 'all';
  limit?: number;
}

export default async function prList(params: PRListParams, _context: { config: Record<string, any> }): Promise<any> {
  const { repo, state = 'open', limit = 10 } = params;

  try {
    const { stdout } = await execFileAsync('gh', [
      'pr', 'list',
      '--repo', repo,
      '--state', state,
      '--limit', String(limit),
      '--json', 'number,title,author,state,createdAt,updatedAt,headRefName,baseRefName'
    ], { env: { ...process.env } });

    const prs = JSON.parse(stdout);

    return {
      success: true,
      repo,
      count: prs.length,
      pullRequests: prs
    };
  } catch (err: any) {
    if (err.message?.includes('not found')) {
      throw new Error(`gh CLI not found. Please install GitHub CLI: https://cli.github.com`);
    }
    if (err.stderr?.includes('authentication')) {
      throw new Error(`GitHub authentication required. Run: gh auth login`);
    }
    throw new Error(`Failed to list PRs: ${err.message}`);
  }
}
