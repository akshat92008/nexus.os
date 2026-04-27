import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { logger } from '../logger.js';
import { sagaManager, type ActionLog } from '../services/SagaManager.js';

const execFileAsync = promisify(execFile);

export interface ToolCall {
  id?: string;
  toolName: string;
  arguments?: Record<string, any> | string;
  missionId?: string;
  taskId?: string;
  userId?: string;
  workspaceId?: string;
}

export interface ToolExecutionContext {
  workspaceRoot?: string;
  sessionId?: string;
}

export interface ToolResult {
  toolCallId?: string;
  status: 'success' | 'error';
  output?: string;
  error?: string;
  data?: any;
}

class ToolExecutor {
  async execute(call: ToolCall, ctx: ToolExecutionContext = {}): Promise<ToolResult> {
    const args = this.normalizeArguments(call.arguments);
    const toolName = call.toolName;

    try {
      const undoParams = await this.calculateUndoParams(toolName, args, ctx);
      if (call.missionId && undoParams) {
        await sagaManager
          .logAction(call.missionId, toolName, args, undoParams)
          .catch((err) => logger.warn({ err, toolName }, '[ToolExecutor] Saga log failed'));
      }

      const data = await this.runTool(toolName, args, ctx);
      return {
        toolCallId: call.id,
        status: 'success',
        output: typeof data === 'string' ? data : JSON.stringify(data),
        data,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ err: message, toolName }, '[ToolExecutor] Tool execution failed');
      return {
        toolCallId: call.id,
        status: 'error',
        error: message,
      };
    }
  }

  async rollbackLast(goalId: string): Promise<any> {
    const action = await sagaManager.getLastAction(goalId);
    if (!action) {
      return { error: 'No actions found' };
    }

    const result = await this.undoAction(action);
    await sagaManager.clearAction(action.id);
    return result;
  }

  async undoAction(action: ActionLog): Promise<any> {
    const { tool_id, undo_params } = action;

    // Sanitize path - reject anything with shell metacharacters
    const safePath = (p: string): string => {
      if (!p || typeof p !== 'string') throw new Error('Invalid undo path');
      if (/[;&|`$<>\\*?!\n\r]/.test(p)) throw new Error(`Unsafe path rejected: ${p}`);
      const resolved = path.resolve(p);
      // Ensure path is within allowed workspace roots
      const ALLOWED_ROOTS = [process.env.WORKSPACE_ROOT || os.homedir()];
      if (!ALLOWED_ROOTS.some(root => resolved.startsWith(root))) {
        throw new Error(`Path escapes allowed workspace: ${resolved}`);
      }
      return resolved;
    };

    switch (tool_id) {
      case 'create_folder': {
        const safe = safePath(undo_params.path);
        await fs.rm(safe, { recursive: true, force: true });
        return { undone: 'create_folder', path: safe };
      }
      case 'write_file': {
        const safe = safePath(undo_params.path);
        if (undo_params.original_content === null || undo_params.original_content === undefined) {
          await fs.unlink(safe).catch(() => {}); // file didn't exist before
        } else {
          await fs.writeFile(safe, undo_params.original_content, 'utf-8');
        }
        return { undone: 'write_file', path: safe };
      }
      case 'delete_file': {
        if (undo_params.original_content) {
          const safe = safePath(undo_params.path);
          await fs.writeFile(safe, undo_params.original_content, 'utf-8');
        }
        return { undone: 'delete_file' };
      }
      default:
        logger.warn({ tool_id }, '[Saga] No undo handler for tool');
        return { undone: false, reason: `No undo for ${tool_id}` };
    }
  }

  private async calculateUndoParams(toolName: string, args: any, ctx: any): Promise<any> {
      case 'write_file': {
        let originalContent: string | null = null;
        try { originalContent = await fs.readFile(args.path, 'utf-8'); } catch {}
        return { path: args.path, original_content: originalContent };
      }
      case 'create_folder':
        return { path: args.path };
      case 'delete_file': {
        let originalContent: string | null = null;
        try { originalContent = await fs.readFile(args.path, 'utf-8'); } catch {}
        return { path: args.path, original_content: originalContent };
      }
      default:
        return null;
    }
  }

  private async runTool(toolName: string, args: any, ctx: ToolExecutionContext): Promise<any> {
    switch (toolName) {
      case 'read_file': {
        const safe = this.resolveWorkspacePath(args.path, ctx);
        return fs.readFile(safe, 'utf-8');
      }
      case 'list_files': {
        const safe = this.resolveWorkspacePath(args.path || '.', ctx);
        return fs.readdir(safe);
      }
      case 'create_folder': {
        const safe = this.resolveWorkspacePath(args.path, ctx);
        await fs.mkdir(safe, { recursive: true });
        return { path: safe, created: true };
      }
      case 'write_file': {
        const safe = this.resolveWorkspacePath(args.path, ctx);
        await fs.mkdir(path.dirname(safe), { recursive: true });
        await fs.writeFile(safe, args.content ?? '', 'utf-8');
        return { path: safe, bytes: Buffer.byteLength(args.content ?? '', 'utf-8') };
      }
      case 'delete_file': {
        const safe = this.resolveWorkspacePath(args.path, ctx);
        await fs.unlink(safe);
        return { path: safe, deleted: true };
      }
      case 'code_execution': {
        return this.executeCode(args.language, args.code);
      }
      default:
        throw new Error(`Tool not implemented: ${toolName}`);
    }
  }

  private normalizeArguments(args: ToolCall['arguments']): Record<string, any> {
    if (!args) return {};
    if (typeof args === 'string') {
      return JSON.parse(args);
    }
    return args;
  }

  private resolveWorkspacePath(inputPath: string, ctx: ToolExecutionContext): string {
    if (!inputPath || typeof inputPath !== 'string') {
      throw new Error('Path is required');
    }

    const workspaceRoot = path.resolve(ctx.workspaceRoot || process.env.WORKSPACE_ROOT || process.cwd());
    const absolute = path.resolve(workspaceRoot, inputPath);

    if (!absolute.startsWith(workspaceRoot)) {
      throw new Error(`Path escapes workspace root: ${inputPath}`);
    }

    return absolute;
  }

  private async executeCode(language: string, code: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    if (!code) {
      throw new Error('Missing code payload');
    }

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nexus-code-'));
    const extension = language === 'javascript' || language === 'node' ? 'js' : 'py';
    const filePath = path.join(tempDir, `snippet.${extension}`);
    const command = extension === 'js' ? 'node' : 'python3';

    await fs.writeFile(filePath, code, 'utf-8');

    try {
      const result = await execFileAsync(command, [filePath], {
        timeout: 15_000,
        maxBuffer: 1024 * 1024,
      });

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: 0,
      };
    } catch (err: any) {
      return {
        stdout: err.stdout ?? '',
        stderr: err.stderr ?? err.message ?? 'Execution failed',
        exitCode: typeof err.code === 'number' ? err.code : 1,
      };
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

export const toolExecutor = new ToolExecutor();

