import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

interface PRViewParams {
  repo: string;
  number: number;
}

export default async function prView(params: PRViewParams, _context: { config: Record<string, any> }): Promise<any> {
  const { repo, number } = params;

  try {
    const { stdout } = await execFileAsync('gh', [
      'pr', 'view', String(number),
      '--repo', repo,
      '--json', 'number,title,body,author,state,createdAt,updatedAt,headRefName,baseRefName,additions,deletions,changedFiles,mergeable,mergeStateStatus,reviewDecision'
    ], { env: { ...process.env } });

    const pr = JSON.parse(stdout);

    return {
      success: true,
      pullRequest: pr
    };
  } catch (err: any) {
    if (err.stderr?.includes('not found')) {
      throw new Error(`PR #${number} not found in ${repo}`);
    }
    throw new Error(`Failed to view PR: ${err.message}`);
  }
}
