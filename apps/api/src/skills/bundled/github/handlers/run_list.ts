import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

interface RunListParams {
  repo: string;
  limit?: number;
}

export default async function runList(params: RunListParams, _context: { config: Record<string, any> }): Promise<any> {
  const { repo, limit = 10 } = params;

  try {
    const { stdout } = await execFileAsync('gh', [
      'run', 'list',
      '--repo', repo,
      '--limit', String(limit),
      '--json', 'databaseId,workflowName,headBranch,status,conclusion,createdAt,updatedAt,event'
    ], { env: { ...process.env } });

    const runs = JSON.parse(stdout);

    // Count by conclusion
    const summary = {
      success: runs.filter((r: any) => r.conclusion === 'success').length,
      failure: runs.filter((r: any) => r.conclusion === 'failure').length,
      in_progress: runs.filter((r: any) => r.status === 'in_progress').length,
      queued: runs.filter((r: any) => r.status === 'queued').length,
      cancelled: runs.filter((r: any) => r.conclusion === 'cancelled').length
    };

    return {
      success: true,
      repo,
      summary,
      runs
    };
  } catch (err: any) {
    throw new Error(`Failed to list runs: ${err.message}`);
  }
}
