import { logger } from '../logger.js';
import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

const DOCKER_IMAGES: Record<string, string> = {
  python: 'python:3.11-slim',
  python3: 'python:3.11-slim',
  javascript: 'node:20-slim',
  node: 'node:20-slim',
  typescript: 'node:20-slim',
  bash: 'ubuntu:22.04',
  sh: 'ubuntu:22.04',
};

const DOCKER_RUN_CMD: Record<string, string[]> = {
  python: ['python3', 'snippet.py'],
  python3: ['python3', 'snippet.py'],
  javascript: ['node', 'snippet.js'],
  node: ['node', 'snippet.js'],
  typescript: ['node', '--input-type=module'],
  bash: ['bash', 'snippet.sh'],
  sh: ['sh', 'snippet.sh'],
};

const FILE_EXT: Record<string, string> = {
  python: 'py',
  python3: 'py',
  javascript: 'js',
  node: 'js',
  typescript: 'ts',
  bash: 'sh',
  sh: 'sh',
};

class DockerSandbox {
  private available: boolean = false;
  private readonly TIMEOUT_MS = 15_000;
  private readonly MAX_OUTPUT = 100 * 1024; // 100KB

  async initialize() {
    logger.info('[DockerSandbox] Checking Docker availability...');
    try {
      await execAsync('docker info', { timeout: 5000 });
      this.available = true;
      logger.info('[DockerSandbox] ✅ Docker is available — sandbox enabled');

      // Pre-pull common images in background (non-blocking)
      this.prePullImages().catch(() => {});
    } catch {
      this.available = false;
      logger.warn('[DockerSandbox] ⚠️  Docker not found — sandbox disabled. Code runs in-process with execFile fallback.');
    }
  }

  private async prePullImages() {
    const images = ['python:3.11-slim', 'node:20-slim'];
    for (const image of images) {
      try {
        await execAsync(`docker pull ${image}`, { timeout: 60_000 });
        logger.info(`[DockerSandbox] Pre-pulled ${image}`);
      } catch {
        // Non-fatal
      }
    }
  }

  async executeCode(language: string, code: string): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
    executionTimeMs: number;
    sandbox: 'docker' | 'process';
  }> {
    const lang = language.toLowerCase();
    const start = Date.now();

    if (this.available && DOCKER_IMAGES[lang]) {
      return this.executeInDocker(lang, code, start);
    }

    // Fallback: run in child process (less isolated but functional)
    return this.executeInProcess(lang, code, start);
  }

  private async executeInDocker(lang: string, code: string, start: number) {
    const image = DOCKER_IMAGES[lang];
    const ext = FILE_EXT[lang] || 'txt';
    const runCmd = DOCKER_RUN_CMD[lang];
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nexus-sandbox-'));
    const filePath = path.join(tempDir, `snippet.${ext}`);

    try {
      await fs.writeFile(filePath, code, 'utf-8');

      // docker run:
      //   --rm          = auto-remove container after run
      //   --network none = no internet access (security)
      //   --memory 128m  = cap RAM
      //   --cpus 0.5     = cap CPU
      //   -v             = mount temp dir read-only
      //   --read-only    = read-only FS except /tmp
      //   --tmpfs /tmp   = writable /tmp inside container
      const dockerArgs = [
        'run', '--rm',
        '--network', 'none',
        '--memory', '128m',
        '--cpus', '0.5',
        '--read-only',
        '--tmpfs', '/tmp:rw,size=50m',
        '-v', `${tempDir}:/workspace:ro`,
        '-w', '/workspace',
        image,
        ...runCmd,
      ];

      const result = await execFileAsync('docker', dockerArgs, {
        timeout: this.TIMEOUT_MS,
        maxBuffer: this.MAX_OUTPUT,
      });

      return {
        stdout: result.stdout.slice(0, this.MAX_OUTPUT),
        stderr: result.stderr.slice(0, this.MAX_OUTPUT),
        exitCode: 0,
        executionTimeMs: Date.now() - start,
        sandbox: 'docker' as const,
      };
    } catch (err: any) {
      return {
        stdout: (err.stdout || '').slice(0, this.MAX_OUTPUT),
        stderr: (err.stderr || err.message || 'Execution failed').slice(0, this.MAX_OUTPUT),
        exitCode: typeof err.code === 'number' ? err.code : 1,
        executionTimeMs: Date.now() - start,
        sandbox: 'docker' as const,
      };
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  private async executeInProcess(lang: string, code: string, start: number) {
    const ext = FILE_EXT[lang];
    if (!ext) {
      return {
        stdout: '',
        stderr: `Unsupported language: ${lang}. Supported: python, javascript, bash`,
        exitCode: 1,
        executionTimeMs: Date.now() - start,
        sandbox: 'process' as const,
      };
    }

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nexus-proc-'));
    const filePath = path.join(tempDir, `snippet.${ext}`);
    const command = lang.includes('python') ? 'python3' : lang.includes('bash') || lang === 'sh' ? 'bash' : 'node';

    try {
      await fs.writeFile(filePath, code, 'utf-8');
      const result = await execFileAsync(command, [filePath], {
        timeout: this.TIMEOUT_MS,
        maxBuffer: this.MAX_OUTPUT,
      });

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: 0,
        executionTimeMs: Date.now() - start,
        sandbox: 'process' as const,
      };
    } catch (err: any) {
      return {
        stdout: err.stdout || '',
        stderr: err.stderr || err.message || 'Execution failed',
        exitCode: typeof err.code === 'number' ? err.code : 1,
        executionTimeMs: Date.now() - start,
        sandbox: 'process' as const,
      };
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  isAvailable(): boolean {
    return this.available;
  }
}

export const dockerSandbox = new DockerSandbox();
