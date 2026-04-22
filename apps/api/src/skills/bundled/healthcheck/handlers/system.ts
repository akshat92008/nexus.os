import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export default async function system(): Promise<any> {
  // macOS-specific system stats
  const [cpuOut, memOut, uptimeOut, loadOut] = await Promise.all([
    execFileAsync('top', ['-l', '1', '-n', '0']),
    execFileAsync('vm_stat'),
    execFileAsync('uptime'),
    execFileAsync('sysctl', ['-n', 'vm.loadavg'])
  ]);

  // Parse CPU
  const cpuMatch = cpuOut.stdout.match(/CPU usage: ([\d.]+)% user, ([\d.]+)% sys, ([\d.]+)% idle/);
  const cpuUsage = cpuMatch ? 100 - parseFloat(cpuMatch[3]) : 0;

  // Parse memory
  const pageSize = 4096;
  const memLines = memOut.stdout.split('\n');
  const getValue = (label: string) => {
    const line = memLines.find(l => l.includes(label));
    const match = line?.match(/(\d+)/);
    return match ? parseInt(match[1]) * pageSize / 1024 / 1024 : 0;
  };

  const freeMem = getValue('Pages free');
  const activeMem = getValue('Pages active');
  const inactiveMem = getValue('Pages inactive');
  const wiredMem = getValue('Pages wired down');
  const totalMem = freeMem + activeMem + inactiveMem + wiredMem;

  // Parse uptime
  const uptimeMatch = uptimeOut.stdout.match(/up (.+?),/);
  const uptime = uptimeMatch ? uptimeMatch[1].trim() : 'unknown';

  // Parse load
  const loadMatch = loadOut.stdout.match(/\{ ([\d.]+) ([\d.]+) ([\d.]+) \}/);

  return {
    success: true,
    platform: 'darwin',
    cpu: {
      usage_percent: Math.round(cpuUsage * 100) / 100,
      user: cpuMatch ? parseFloat(cpuMatch[1]) : 0,
      system: cpuMatch ? parseFloat(cpuMatch[2]) : 0
    },
    memory: {
      total_mb: Math.round(totalMem),
      used_mb: Math.round(activeMem + wiredMem),
      free_mb: Math.round(freeMem),
      usage_percent: Math.round((activeMem + wiredMem) / totalMem * 1000) / 10
    },
    load_average: loadMatch ? [parseFloat(loadMatch[1]), parseFloat(loadMatch[2]), parseFloat(loadMatch[3])] : [0, 0, 0],
    uptime
  };
}
