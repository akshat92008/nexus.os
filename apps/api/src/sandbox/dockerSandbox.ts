import { logger } from '../logger.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class DockerSandbox {
  private available: boolean = false;

  async initialize() {
    logger.info('[DockerSandbox] Initializing...');
    try {
      await execAsync('docker info');
      this.available = true;
      logger.info('[DockerSandbox] Docker is available');
    } catch (err) {
      this.available = false;
      logger.warn('[DockerSandbox] Docker not found or not running. Sandboxing disabled.');
    }
  }

  async executeCode(language: string, code: string): Promise<any> {
    if (!this.available) {
      return { error: 'Docker not available' };
    }
    // Real implementation would spawn a container here
    return { success: true, stdout: 'Mock output from sandbox', stderr: '' };
  }

  isAvailable(): boolean {
    return this.available;
  }
}

export const dockerSandbox = new DockerSandbox();
