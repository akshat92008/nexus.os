/**
 * Nexus OS — Sandbox Manager
 *
 * Secure code execution environment powered by e2b.
 * Allows agents to execute Python, JS, or Shell code in a multi-tenant sandbox.
 */

import { CodeInterpreter } from '@e2b/code-interpreter';

export interface SandboxResult {
  stdout: string[];
  stderr: string[];
  exitCode?: number;
  error?: string;
  results?: any[]; // For notebook-style outputs (charts, dataframes)
}

class SandboxManager {
  private readonly TIMEOUT_MS = 60_000; // 1 minute limit

  /**
   * Run code in the sandbox and capture output.
   */
  async runCode(language: 'python' | 'javascript' | 'bash', code: string): Promise<SandboxResult> {
    let sandbox: CodeInterpreter | null = null;
    const stdout: string[] = [];
    const stderr: string[] = [];

    try {
      // 1. Initialize sandbox (requires E2B_API_KEY in process.env)
      sandbox = await CodeInterpreter.create();
      console.log(`[SandboxManager] 🚀 Executing ${language} code...`);

      if (language === 'python') {
        // Python runs in a notebook-style environment
        const execution = await sandbox.notebook.execCell(code);
        return {
          stdout: execution.logs.stdout,
          stderr: execution.logs.stderr,
          results: execution.results,
          error: execution.error?.value,
        };
      } else {
        // JS/Bash run as shell processes
        let cmd = '';
        let args: string[] = [];

        if (language === 'javascript') {
          cmd = 'node';
          args = ['-e', code];
        } else {
          cmd = 'bash';
          args = ['-c', code];
        }

        const proc = await sandbox.commands.run(cmd, {
          args,
          onStdout: (data) => stdout.push(data),
          onStderr: (data) => stderr.push(data),
          timeout: this.TIMEOUT_MS,
        });

        return {
          stdout,
          stderr,
          exitCode: proc.exitCode,
          error: proc.error,
        };
      }
    } catch (err: any) {
      console.error('[SandboxManager] ❌ Execution failed:', err);
      return {
        stdout,
        stderr,
        error: err.message,
      };
    } finally {
      if (sandbox) {
        await sandbox.close();
        console.log('[SandboxManager] 🧹 Sandbox destroyed.');
      }
    }
  }
}

export const sandboxManager = new SandboxManager();
