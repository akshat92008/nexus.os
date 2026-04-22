/**
 * Nexus OS — Docker Sandbox Lifecycle Manager
 * Inspired by OpenClaw's sandbox system for isolated skill execution
 */
import { logger } from '../logger.js';
import { eventBus } from '../events/eventBus.js';
import { randomUUID } from 'crypto';
import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

export interface SandboxConfig {
  image: string;
  memory?: string;       // e.g. "512m"
  cpus?: string;         // e.g. "1.0"
  timeout?: number;      // ms
  network?: boolean;
  volumes?: Array<{ host: string; container: string; mode?: string }>;
  envVars?: Record<string, string>;
  workDir?: string;
  entrypoint?: string[];
  cmd?: string[];
}

export interface SandboxInstance {
  id: string;
  config: SandboxConfig;
  containerId?: string;
  status: 'creating' | 'running' | 'paused' | 'stopped' | 'error';
  process?: ChildProcess;
  startTime?: Date;
  endTime?: Date;
  exitCode?: number;
  logs: string[];
  stdout: string;
  stderr: string;
}

class DockerSandboxManager {
  private instances: Map<string, SandboxInstance> = new Map();
  private dockerAvailable: boolean = false;
  private maxInstances: number = 10;

  async initialize() {
    logger.info('[DockerSandbox] Checking Docker availability...');
    
    try {
      const { execFile } = await import('child_process');
      const { promisify } = await import('util');
      await promisify(execFile)('docker', ['version', '--format', '{{.Server.Version}}']);
      this.dockerAvailable = true;
      logger.info('[DockerSandbox] Docker available');
    } catch {
      logger.warn('[DockerSandbox] Docker not available. Sandbox mode will use process isolation.');
    }
  }

  async createSandbox(config: SandboxConfig): Promise<SandboxInstance> {
    const id = randomUUID();
    
    const instance: SandboxInstance = {
      id,
      config,
      status: 'creating',
      logs: [],
      stdout: '',
      stderr: ''
    };

    // Check limits
    const running = Array.from(this.instances.values()).filter(i => i.status === 'running');
    if (running.length >= this.maxInstances) {
      throw new Error(`Max sandbox instances reached (${this.maxInstances})`);
    }

    this.instances.set(id, instance);

    if (this.dockerAvailable) {
      await this.createDockerContainer(instance);
    } else {
      await this.createProcessSandbox(instance);
    }

    logger.info(`[DockerSandbox] Created sandbox ${id} (${config.image})`);
    return instance;
  }

  private async createDockerContainer(instance: SandboxInstance) {
    const { config } = instance;
    
    const args = [
      'run', '-d',
      '--name', `nexus-sandbox-${instance.id}`,
      '--memory', config.memory || '512m',
      '--cpus', config.cpus || '1.0',
      '--network', config.network !== false ? 'bridge' : 'none',
      '--rm',
      '-w', config.workDir || '/workspace'
    ];

    // Add env vars
    for (const [key, value] of Object.entries(config.envVars || {})) {
      args.push('-e', `${key}=${value}`);
    }

    // Add volumes
    for (const vol of config.volumes || []) {
      args.push('-v', `${vol.host}:${vol.container}${vol.mode ? ':' + vol.mode : ''}`);
    }

    // Add entrypoint if specified
    if (config.entrypoint) {
      args.push('--entrypoint', config.entrypoint[0]);
    }

    args.push(config.image);
    args.push(...(config.cmd || []));

    try {
      const proc = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] });
      instance.process = proc;

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => { stdout += data.toString(); });
      proc.stderr?.on('data', (data) => { stderr += data.toString(); });

      const exitCode = await new Promise<number>((resolve) => {
        proc.on('close', (code) => resolve(code ?? 0));
        proc.on('error', () => resolve(1));
      });

      if (exitCode !== 0) {
        instance.status = 'error';
        instance.stderr = stderr;
        throw new Error(`Docker container creation failed: ${stderr}`);
      }

      instance.containerId = stdout.trim();
      instance.status = 'running';
      instance.startTime = new Date();

      // Set timeout
      if (config.timeout) {
        setTimeout(() => this.stopSandbox(instance.id), config.timeout);
      }
    } catch (err: any) {
      instance.status = 'error';
      instance.stderr = err.message;
      throw err;
    }
  }

  private async createProcessSandbox(instance: SandboxInstance) {
    // Fallback: run in a child process with limited environment
    // This is less secure than Docker but works without it
    instance.status = 'running';
    instance.startTime = new Date();
    logger.info(`[DockerSandbox] Process sandbox ${instance.id} running (no Docker)`);
  }

  async executeInSandbox(sandboxId: string, command: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const instance = this.instances.get(sandboxId);
    if (!instance) throw new Error(`Sandbox ${sandboxId} not found`);
    if (instance.status !== 'running') throw new Error(`Sandbox ${sandboxId} is not running`);

    if (this.dockerAvailable && instance.containerId) {
      return this.execDocker(sandboxId, command);
    } else {
      return this.execProcess(sandboxId, command);
    }
  }

  private async execDocker(sandboxId: string, command: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const instance = this.instances.get(sandboxId)!;

    return new Promise((resolve, reject) => {
      const proc = spawn('docker', ['exec', instance.containerId!, ...command], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => { stdout += data.toString(); });
      proc.stderr?.on('data', (data) => { stderr += data.toString(); });

      proc.on('close', (code) => {
        instance.logs.push(`[exec] ${command.join(' ')} -> ${code}`);
        resolve({ stdout, stderr, exitCode: code ?? 0 });
      });

      proc.on('error', (err) => reject(err));
    });
  }

  private async execProcess(sandboxId: string, command: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    // Fallback: execute in limited subprocess
    const proc = spawn(command[0], command.slice(1), {
      env: { PATH: process.env.PATH },
      timeout: 30000
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => { stdout += data.toString(); });
    proc.stderr?.on('data', (data) => { stderr += data.toString(); });

    return new Promise((resolve) => {
      proc.on('close', (code) => resolve({ stdout, stderr, exitCode: code ?? 0 }));
    });
  }

  async copyToSandbox(sandboxId: string, hostPath: string, containerPath: string): Promise<void> {
    const instance = this.instances.get(sandboxId);
    if (!instance || !instance.containerId) throw new Error('Docker required for file copy');

    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    
    await promisify(execFile)('docker', ['cp', hostPath, `${instance.containerId}:${containerPath}`]);
  }

  async copyFromSandbox(sandboxId: string, containerPath: string, hostPath: string): Promise<void> {
    const instance = this.instances.get(sandboxId);
    if (!instance || !instance.containerId) throw new Error('Docker required for file copy');

    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    
    await promisify(execFile)('docker', ['cp', `${instance.containerId}:${containerPath}`, hostPath]);
  }

  async stopSandbox(sandboxId: string): Promise<void> {
    const instance = this.instances.get(sandboxId);
    if (!instance) return;

    instance.status = 'stopped';
    instance.endTime = new Date();

    if (this.dockerAvailable && instance.containerId) {
      try {
        const { execFile } = await import('child_process');
        const { promisify } = await import('util');
        await promisify(execFile)('docker', ['stop', '-t', '5', instance.containerId]);
        await promisify(execFile)('docker', ['rm', instance.containerId]);
      } catch (err: any) {
        logger.warn(`[DockerSandbox] Cleanup error: ${err.message}`);
      }
    }

    if (instance.process) {
      instance.process.kill('SIGTERM');
      setTimeout(() => instance.process?.kill('SIGKILL'), 5000);
    }

    logger.info(`[DockerSandbox] Stopped sandbox ${sandboxId}`);
  }

  async pauseSandbox(sandboxId: string): Promise<void> {
    const instance = this.instances.get(sandboxId);
    if (!instance || !instance.containerId) return;

    try {
      const { execFile } = await import('child_process');
      const { promisify } = await import('util');
      await promisify(execFile)('docker', ['pause', instance.containerId]);
      instance.status = 'paused';
    } catch (err: any) {
      logger.warn(`[DockerSandbox] Pause failed: ${err.message}`);
    }
  }

  async unpauseSandbox(sandboxId: string): Promise<void> {
    const instance = this.instances.get(sandboxId);
    if (!instance || !instance.containerId) return;

    try {
      const { execFile } = await import('child_process');
      const { promisify } = await import('util');
      await promisify(execFile)('docker', ['unpause', instance.containerId]);
      instance.status = 'running';
    } catch (err: any) {
      logger.warn(`[DockerSandbox] Unpause failed: ${err.message}`);
    }
  }

  getSandbox(id: string): SandboxInstance | undefined {
    return this.instances.get(id);
  }

  getRunningSandboxes(): SandboxInstance[] {
    return Array.from(this.instances.values()).filter(i => i.status === 'running');
  }

  cleanup(): void {
    for (const [id, instance] of this.instances) {
      if (instance.status === 'running') {
        this.stopSandbox(id);
      }
    }
  }
}

export const dockerSandbox = new DockerSandboxManager();
