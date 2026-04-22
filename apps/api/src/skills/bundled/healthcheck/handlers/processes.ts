import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export default async function processes(params: { sort_by?: string; limit?: number }): Promise<any> {
  const { sort_by = 'cpu', limit = 20 } = params;

  const { stdout } = await execFileAsync('ps', [
    '-arcwwwxo',
    'pid,pcpu,pmem,time,comm'
  ]);

  const lines = stdout.trim().split('\n').slice(1); // Skip header
  const procs = lines.map(line => {
    const parts = line.trim().split(/\s+/);
    return {
      pid: parseInt(parts[0]) || 0,
      cpu: parseFloat(parts[1]) || 0,
      mem: parseFloat(parts[2]) || 0,
      time: parts[3] || '',
      command: parts.slice(4).join(' ') || ''
    };
  }).filter(p => p.pid > 0);

  const sorted = procs.sort((a, b) => {
    return sort_by === 'cpu' ? b.cpu - a.cpu : b.mem - a.mem;
  });

  return {
    success: true,
    sort_by,
    processes: sorted.slice(0, limit)
  };
}
