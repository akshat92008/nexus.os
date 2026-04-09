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
    options?: { timeout?: number; signal?: AbortSignal }
  ): Promise<SandboxResult> {
    let sandbox: any = null;
    const stdout: string[] = [];
    const stderr: string[] = [];
    const timeout = options?.timeout ?? this.TIMEOUT_MS;
    let timeoutHandle: NodeJS.Timeout | null = null;
    let aborted = false;

    const cleanupSandbox = async () => {
      if (sandbox) {
        try {
          await sandbox.close();
          console.log('[SandboxManager] 🧹 Sandbox destroyed (Isolated Teardown).');
        } catch (closeErr) {
          console.warn('[SandboxManager] ⚠️ Sandbox cleanup failed:', closeErr);
        }
        sandbox = null;
      }
    };

    const abortHandler = () => {
      aborted = true;
      cleanupSandbox().catch(() => undefined);
    };

    options?.signal?.addEventListener?.('abort', abortHandler);

    try {
      // 🚨 HARDEN 4: Enhanced lifecycle management
      sandbox = await (Sandbox as any).create({ 
        timeout,
        ...(options?.signal ? { signal: options.signal } : {})
      });
      
      console.log(`[SandboxManager] 🚀 Executing ${language} code with ${timeout}ms timeout...`);

      if (options?.signal?.aborted) throw new Error('Sandbox aborted before start');

      timeoutHandle = setTimeout(() => {
        aborted = true;
        if (sandbox) {
          sandbox.close().catch((e: any) => console.warn('[SandboxManager] ⚠️ Auto-close sandbox failed:', e));
        }
      }, timeout + 1000);

      const onOutput = (type: 'stdout' | 'stderr', message: string) => {
        if (type === 'stdout') stdout.push(message);
        else stderr.push(message);
        onLog?.(type, message);
      };

      if (language === 'python') {
        // Python runs in a notebook-style environment
        const execution = await sandbox.notebook.execCell(code, {
          onStdout: (data: { text: string }) => onOutput('stdout', data.text),
          onStderr: (data: { text: string }) => onOutput('stderr', data.text),
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
          onStdout: (data: string) => onOutput('stdout', data),
          onStderr: (data: string) => onOutput('stderr', data),
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
      const message = aborted ? `Sandbox killed after timeout (${timeout}ms)` : err?.message || String(err);
      console.error('[SandboxManager] ❌ Execution failed:', message);
      return {
        stdout,
        stderr,
        error: message,
      };
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      options?.signal?.removeEventListener?.('abort', abortHandler);
      await cleanupSandbox();
    }
  }
}

export const sandboxManager = new SandboxManager();
