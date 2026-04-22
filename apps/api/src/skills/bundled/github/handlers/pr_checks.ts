import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

interface PRChecksParams {
  repo: string;
  number: number;
}

export default async function prChecks(params: PRChecksParams, _context: { config: Record<string, any> }): Promise<any> {
  const { repo, number } = params;

  try {
    const { stdout } = await execFileAsync('gh', [
      'pr', 'checks', String(number),
      '--repo', repo,
      '--json', 'name,state,startedAt,completedAt,link'
    ], { env: { ...process.env } });

    const checks = JSON.parse(stdout);

    // Count by state
    const summary = {
      pending: checks.filter((c: any) => c.state === 'PENDING' || c.state === 'IN_PROGRESS').length,
      success: checks.filter((c: any) => c.state === 'SUCCESS' || c.state === 'COMPLETED').length,
      failed: checks.filter((c: any) => c.state === 'FAILURE' || c.state === 'ERROR').length,
      skipped: checks.filter((c: any) => c.state === 'SKIPPED' || c.state === 'NEUTRAL').length
    };

    return {
      success: true,
      summary,
      checks
    };
  } catch (err: any) {
    if (err.stderr?.includes('no checks')) {
      return {
        success: true,
        summary: { pending: 0, success: 0, failed: 0, skipped: 0 },
        checks: [],
        message: 'No checks found for this PR'
      };
    }
    throw new Error(`Failed to get checks: ${err.message}`);
  }
}
