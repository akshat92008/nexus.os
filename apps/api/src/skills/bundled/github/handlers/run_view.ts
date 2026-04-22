import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

interface RunViewParams {
  repo: string;
  run_id: string;
}

export default async function runView(params: RunViewParams, _context: { config: Record<string, any> }): Promise<any> {
  const { repo, run_id } = params;

  try {
    const { stdout } = await execFileAsync('gh', [
      'run', 'view', run_id,
      '--repo', repo,
      '--json', 'databaseId,workflowName,headBranch,status,conclusion,createdAt,updatedAt,event,jobs'
    ], { env: { ...process.env } });

    const run = JSON.parse(stdout);

    return {
      success: true,
      run
    };
  } catch (err: any) {
    if (err.stderr?.includes('not found')) {
      throw new Error(`Run ${run_id} not found in ${repo}`);
    }
    throw new Error(`Failed to view run: ${err.message}`);
  }
}
