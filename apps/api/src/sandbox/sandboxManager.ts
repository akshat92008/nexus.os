import { dockerSandbox } from './dockerSandbox.js';
import { logger } from '../logger.js';

class SandboxManager {
  async initialize() {
    logger.info('[SandboxManager] Initializing...');
    await dockerSandbox.initialize();
  }

  async run(language: string, code: string) {
    return dockerSandbox.executeCode(language, code);
  }
}

export const sandboxManager = new SandboxManager();
