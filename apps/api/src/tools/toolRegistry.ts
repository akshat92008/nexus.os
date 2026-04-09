/**
 * Nexus OS — Tool Registry
 *
 * Defines the schema and metadata for all executable tools available to agents.
 */

export type ToolCategory = 'communication' | 'productivity' | 'coding' | 'system' | 'web';

export interface ToolSchema {
  name: string;
  description: string;
  category: ToolCategory;
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
  handler: (args: any) => Promise<any>;
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
      handler: async ({ url, method = 'GET', body }) => {
        const res = await fetch(url, {
          method,
          headers: body ? { 'Content-Type': 'application/json' } : {},
          body: body ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) throw new Error(`HTTP Error: ${res.status} ${res.statusText}`);
        return await res.json();
      },
    });

    // 2. File System Tool (Placeholder for local/sandbox access)
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
      handler: async ({ path }) => {
        // Implementation would use nexusFS or similar
        return { content: `Content of ${path} (mocked)` };
      },
    });

    // 3. GitHub Tool (Placeholder)
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
      handler: async ({ name, description, private: isPrivate }) => {
        // Mock GitHub API call
        return { url: `https://github.com/nexus-os/${name}`, id: Math.random().toString(36).slice(2) };
      },
    });
  }
}

export const toolRegistry = new ToolRegistry();
