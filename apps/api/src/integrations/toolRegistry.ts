import { Tool } from './types.js';
import { emailDriver } from './drivers/emailDriver.js';
import { githubDriver } from './drivers/githubDriver.js';
import { searchDriver } from './drivers/searchDriver.js';
import { docDriver } from './drivers/docDriver.js';

const TOOLS: Tool[] = [
  emailDriver,
  githubDriver,
  searchDriver,
  docDriver,
];

const toolRegistry = new Map<string, Tool>(TOOLS.map(t => [t.id, t]));

export function registerToolDriver(tool: Tool): void {
  console.log(`[Integration] 🔌 Registering dynamic tool driver: ${tool.id}`);
  toolRegistry.set(tool.id, tool);
}

export function unregisterToolDriver(toolId: string): void {
  toolRegistry.delete(toolId);
}

export function getTool(id: string): Tool | undefined {
  return toolRegistry.get(id);
}

export function listTools(): Tool[] {
  return Array.from(toolRegistry.values());
}
