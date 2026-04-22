import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

interface IssueListParams {
  repo: string;
  state?: 'open' | 'closed' | 'all';
  limit?: number;
}

export default async function issueList(params: IssueListParams, _context: { config: Record<string, any> }): Promise<any> {
  const { repo, state = 'open', limit = 10 } = params;

  try {
    const { stdout } = await execFileAsync('gh', [
      'issue', 'list',
      '--repo', repo,
      '--state', state,
      '--limit', String(limit),
      '--json', 'number,title,author,state,createdAt,updatedAt,labels,commentsCount'
    ], { env: { ...process.env } });

    const issues = JSON.parse(stdout);

    return {
      success: true,
      repo,
      count: issues.length,
      issues
    };
  } catch (err: any) {
    throw new Error(`Failed to list issues: ${err.message}`);
  }
}
