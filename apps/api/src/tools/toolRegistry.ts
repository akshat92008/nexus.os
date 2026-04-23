/**
 * Nexus OS — Tool Registry
 *
 * Defines the schema and metadata for all executable tools available to agents.
 */

import { z } from 'zod';
import { sandboxManager } from '../sandbox/sandboxManager.js';
import { nexusFS } from '../storage/nexusFS.js';
import { githubDriver } from '../integrations/drivers/githubDriver.js';
import { skillRuntime } from './skillRuntime.js';

export type ToolCategory = 'communication' | 'productivity' | 'coding' | 'system' | 'web';

export interface ToolSchema {
  name: string;
  description: string;
  category: ToolCategory;
  schema?: z.ZodSchema;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: any[];
    }>;
    required: string[];
  };
}

export interface Tool extends ToolSchema {
  handler: (args: any, context: { userId: string; workspaceId?: string }) => Promise<any>;
}

class ToolRegistry {
  private tools = new Map<string, Tool>();

  constructor() {
    this.registerDefaultTools();
  }

  register(tool: Tool) {
    this.tools.set(tool.name, tool);
    console.log(`[ToolRegistry] 🛠️ Registered tool: ${tool.name}`);
  }

  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  listTools(): ToolSchema[] {
    return Array.from(this.tools.values()).map(({ handler, ...schema }) => schema);
  }

  private registerDefaultTools() {
    // 1. HTTP API Tool
    this.register({
      name: 'http_fetch',
      description: 'Fetch data from an external HTTP API.',
      category: 'web',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The URL to fetch.' },
          method: { type: 'string', description: 'HTTP method (GET, POST, etc.)', enum: ['GET', 'POST', 'PUT', 'DELETE'] },
          body: { type: 'string', description: 'Optional request body (JSON string).' },
        },
        required: ['url'],
      },
      handler: async ({ url, method = 'GET', body }, { userId }) => {
        const res = await fetch(url, {
          method,
          headers: body ? { 'Content-Type': 'application/json' } : {},
          body: body ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) throw new Error(`HTTP Error: ${res.status} ${res.statusText}`);
        return await res.json();
      },
    });

    // 2. File System Tool
    this.register({
      name: 'fs_read',
      description: 'Read a file from the workspace.',
      category: 'system',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative path to the file.' },
        },
        required: ['path'],
      },
      handler: async ({ path }, { userId }) => {
        const content = await nexusFS.readFile(path, userId);
        return { content };
      },
    });

    // 3. GitHub Tool
    this.register({
      name: 'github_create_repo',
      description: 'Create a new repository on GitHub.',
      category: 'coding',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'The name of the repository.' },
          description: { type: 'string', description: 'Repository description.' },
          private: { type: 'boolean', description: 'Whether the repo should be private.' },
        },
        required: ['name'],
      },
      handler: async ({ name, description, private: isPrivate }, { workspaceId }) => {
        if (!workspaceId) throw new Error('Workspace context missing for GitHub tool.');
        const result = await githubDriver.execute({
          repo: name, // Simplified for creation
          action: 'create_repo',
          title: name,
          body: description,
          private: isPrivate
        }, workspaceId);
        return result;
      },
    });
    this.register({
      name: 'code_execution',
      description: 'Execute code in a secure sandbox.',
      category: 'coding',
      schema: z.object({ 
        language: z.enum(['python', 'javascript', 'bash']), 
        code: z.string().max(10_000, 'Code payload too large'), 
      }),
      parameters: {
        type: 'object',
        properties: {
          language: { type: 'string', description: 'The programming language.', enum: ['python', 'javascript', 'bash'] },
          code: { type: 'string', description: 'The code to execute.' },
        },
        required: ['language', 'code'],
      },
      handler: async ({ language, code }) => {
        const result = await sandboxManager.runCode(language, code);
        return result;
      },
    });

    this.register({
      name: 'skill_execute',
      description: 'Execute a registered skill through the Nexus skill runtime.',
      category: 'system',
      schema: z.object({
        skillId: z.string().min(1),
        params: z.record(z.any()).default({}),
        bypassCache: z.boolean().optional(),
      }),
      parameters: {
        type: 'object',
        properties: {
          skillId: { type: 'string', description: 'The registered skill identifier.' },
          params: { type: 'object', description: 'Arbitrary parameter payload for the skill.' },
          bypassCache: { type: 'boolean', description: 'Whether to skip the runtime cache.' },
        },
        required: ['skillId'],
      },
      handler: async ({ skillId, params = {}, bypassCache = false }) => {
        const result = await skillRuntime.executeSkill(skillId, params, { bypassCache });
        if (!result.success) {
          throw new Error(result.error || `Skill "${skillId}" failed`);
        }
        return result;
      },
    });

    // Safe folder deletion (undo inverse of create_folder)
    this.register({
      name: 'delete_folder',
      description: 'Safely delete a folder created by an agent. Only deletes within workspace root.',
      category: 'system',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the folder to delete.' },
        },
        required: ['path'],
      },
      handler: async ({ path: targetPath }, { userId }) => {
        const { rm } = await import('fs/promises');
        const pathModule = await import('path');
        const workspaceRoot = process.cwd();
        const resolved = pathModule.default.resolve(targetPath);
        if (!resolved.startsWith(workspaceRoot)) {
          throw new Error(`[Security] Path traversal blocked: ${targetPath}`);
        }
        await rm(resolved, { recursive: true, force: false });
        return { deleted: resolved };
      },
    });

    // Safe file deletion (undo for new files created by agent)
    this.register({
      name: 'delete_file',
      description: 'Safely delete a file created by an agent. Only deletes within workspace root.',
      category: 'system',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the file to delete.' },
        },
        required: ['path'],
      },
      handler: async ({ path: targetPath }, { userId }) => {
        const { unlink } = await import('fs/promises');
        const pathModule = await import('path');
        const workspaceRoot = process.cwd();
        const resolved = pathModule.default.resolve(targetPath);
        if (!resolved.startsWith(workspaceRoot)) {
          throw new Error(`[Security] Path traversal blocked: ${targetPath}`);
        }
        await unlink(resolved);
        return { deleted: resolved };
      },
    });
  }
}

export const toolRegistry = new ToolRegistry();
