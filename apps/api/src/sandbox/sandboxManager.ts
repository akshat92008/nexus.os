import { Sandbox } from '@e2b/code-interpreter';

export interface SandboxResult {
  stdout: string[];
  stderr: string[];
  exitCode?: number;
  error?: string;
  results?: any[]; // For notebook-style outputs (charts, dataframes)
}

class SandboxManager {
  private readonly TIMEOUT_MS = 30_000; // 🧱 FIX 6: 30s hard limit

  /**
   * Run code in the sandbox and capture output.
   */
  async runCode(
    language: 'python' | 'javascript' | 'bash', 
    code: string,
    onLog?: (type: 'stdout' | 'stderr', data: string) => void,
    options?: { timeout?: number }
  ): Promise<SandboxResult> {
    let sandbox: any = null;
    const stdout: string[] = [];
    const stderr: string[] = [];
    const timeout = options?.timeout ?? this.TIMEOUT_MS;

    try {
      // 1. Initialize sandbox (requires E2B_API_KEY in process.env)
      sandbox = await (Sandbox as any).create({ timeout });
      console.log(`[SandboxManager] 🚀 Executing ${language} code with ${timeout}ms timeout...`);

      if (language === 'python') {
        // Python runs in a notebook-style environment
        const execution = await sandbox.notebook.execCell(code, {
          onStdout: (data: { text: string }) => {
            stdout.push(data.text);
            onLog?.('stdout', data.text);
          },
          onStderr: (data: { text: string }) => {
            stderr.push(data.text);
            onLog?.('stderr', data.text);
          }
        });
        
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
          onStdout: (data: string) => {
            stdout.push(data);
            onLog?.('stdout', data);
          },
          onStderr: (data: string) => {
            stderr.push(data);
            onLog?.('stderr', data);
          },
          timeout,
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
