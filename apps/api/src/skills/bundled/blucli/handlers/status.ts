import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export default async function status(): Promise<any> {
  const { stdout } = await execFileAsync('bluetoothctl', ['show']);

  const powerMatch = stdout.match(/Powered: (yes|no)/);
  const discoverableMatch = stdout.match(/Discoverable: (yes|no)/);
  const pairableMatch = stdout.match(/Pairable: (yes|no)/);

  return {
    success: true,
    powered: powerMatch ? powerMatch[1] === 'yes' : null,
    discoverable: discoverableMatch ? discoverableMatch[1] === 'yes' : null,
    pairable: pairableMatch ? pairableMatch[1] === 'yes' : null,
    raw: stdout
  };
}
