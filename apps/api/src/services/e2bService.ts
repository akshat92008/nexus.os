import CodeInterpreter from '@e2b/code-interpreter';
import { logger } from '../logger.js';

/**
 * E2B Code Interpreter Service Wrapper
 * Isolated service for secure code execution in sandbox environment
 */
export class E2BService {
  /**
   * Executes Python code in an isolated E2B sandbox
   * @param code Python source code to execute
   * @returns Execution results with stdout, stderr and output values
   */
  static async executePythonCode(code: string) {
    let sandbox: CodeInterpreter | null = null;

    try {
      logger.info('Initializing E2B sandbox for Python code execution');
      
      // Initialize sandbox environment
      sandbox = await CodeInterpreter.create({
        timeout: 300, // 5 minute default timeout
      });

      logger.debug('Executing Python code in sandbox');
      const execution = await sandbox.notebook.execCell(code);

      const result = {
        stdout: execution.stdout,
        stderr: execution.stderr,
        results: execution.results,
        success: !execution.error,
        error: execution.error || null
      };

      logger.info({
        hasResults: result.results.length > 0,
        hasStderr: result.stderr.length > 0
      }, 'Python code execution completed successfully');

      return result;
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }, 'E2B sandbox execution failed');

      return {
        stdout: '',
        stderr: error instanceof Error ? error.message : 'Unknown error occurred',
        results: [],
        success: false,
        error
      };
    } finally {
      if (sandbox) {
        try {
          await sandbox.kill();
          logger.debug('E2B sandbox terminated successfully');
        } catch (cleanupError) {
          logger.error({
            error: cleanupError instanceof Error ? cleanupError.message : 'Cleanup error'
          }, 'Failed to terminate E2B sandbox');
        }
      }
    }
  }
}