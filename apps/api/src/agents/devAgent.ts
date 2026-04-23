/**
 * Nexus OS — Dev Agent
 *
 * Handles developer workflows: git, shell, code review, testing, scaffolding.
 * Uses ReAct pattern: Observe → Analyze → Plan → Execute → Verify.
 */

import { logger } from '../logger.js';

export const devAgentPrompt = `
You are the Nexus OS Dev Agent — a senior engineer who works autonomously.
You write production-quality code, not quick hacks.
You ALWAYS verify your work: run tests after fixing, check output after shell commands.
You use the ReAct pattern: Observe → Analyze → Plan → Execute → Verify.

TOOLS AVAILABLE:
- shell(command): Execute bash with persistent session (cd persists between calls)
- read_file(path): Read file contents
- write_file(path, content): Write or overwrite file
- patch_file(path, search, replace): Precise search-and-replace
- git(action, params): git diff, commit, branch, status, log, push
- run_tests(path?): Run test suite, return structured results
- global_search(query): Regex search across codebase
- list_files(depth): Directory tree

OUTPUT FORMAT:
{
  "goal": "What this achieves for the developer",
  "risk_level": "low | medium | high",
  "requires_approval": boolean,
  "tasks": [
    { "step": 1, "tool": "tool_name", "params": {}, "description": "Human-readable description", "depends_on": [] }
  ]
}
`;

export interface DevPlan {
  goal: string;
  risk_level: 'low' | 'medium' | 'high';
  requires_approval: boolean;
  tasks: Array<{
    step: number;
    tool: string;
    params: Record<string, any>;
    description: string;
    depends_on: number[];
  }>;
}

export class DevAgent {
  async plan(intent: string, context?: Record<string, any>): Promise<DevPlan> {
    logger.info({ intent }, '[DevAgent] Planning developer mission');

    const lower = intent.toLowerCase();

    if (lower.includes('review') && (lower.includes('commit') || lower.includes('last'))) {
      return {
        goal: 'Review the most recent commit for bugs, style, and security issues',
        risk_level: 'low',
        requires_approval: false,
        tasks: [
          { step: 1, tool: 'git', params: { action: 'diff', params: 'HEAD~1' }, description: 'Get diff of last commit', depends_on: [] },
          { step: 2, tool: 'git', params: { action: 'log', params: { limit: 1 } }, description: 'Get commit message for context', depends_on: [] },
          { step: 3, tool: 'code_review', params: { diff: '{{step1.output}}', commit_message: '{{step2.output}}' }, description: 'LLM analysis of changes', depends_on: [1, 2] },
          { step: 4, tool: 'format_review', params: { review: '{{step3.output}}' }, description: 'Format structured review with line numbers', depends_on: [3] },
        ],
      };
    }

    if (lower.includes('fix') && lower.includes('test')) {
      return {
        goal: 'Diagnose and fix the failing test',
        risk_level: 'medium',
        requires_approval: true,
        tasks: [
          { step: 1, tool: 'run_tests', params: {}, description: 'Run tests to capture failure output', depends_on: [] },
          { step: 2, tool: 'read_file', params: { path: '{{failing_test_path}}' }, description: 'Read the failing test file', depends_on: [1] },
          { step: 3, tool: 'read_file', params: { path: '{{source_under_test}}' }, description: 'Read source code being tested', depends_on: [1] },
          { step: 4, tool: 'diagnose_failure', params: { test: '{{step2.output}}', source: '{{step3.output}}', error: '{{step1.output}}' }, description: 'LLM diagnosis of root cause', depends_on: [2, 3] },
          { step: 5, tool: 'patch_file', params: { path: '{{source_under_test}}', search: '{{diagnosis.search}}', replace: '{{diagnosis.replace}}' }, description: 'Apply fix to source code', depends_on: [4] },
          { step: 6, tool: 'run_tests', params: {}, description: 'Verify fix by re-running tests', depends_on: [5] },
        ],
      };
    }

    if (lower.includes('new') && lower.includes('project') && (lower.includes('next') || lower.includes('react') || lower.includes('scaffold'))) {
      const name = intent.match(/(?:next\.?js|react|node) project (?:called|named)?\s*['"]?([^'"\s]+)['"]?/i)?.[1] || 'my-app';
      return {
        goal: `Scaffold a new Next.js project called ${name}`,
        risk_level: 'low',
        requires_approval: false,
        tasks: [
          { step: 1, tool: 'shell', params: { command: `npx create-next-app@latest ${name} --typescript --tailwind --eslint` }, description: 'Create Next.js project with TypeScript and Tailwind', depends_on: [] },
          { step: 2, tool: 'list_files', params: { path: `./${name}`, depth: 2 }, description: 'List generated project structure', depends_on: [1] },
          { step: 3, tool: 'read_file', params: { path: `./${name}/package.json` }, description: 'Inspect package.json', depends_on: [1] },
          { step: 4, tool: 'write_file', params: { path: `./${name}/.env.local`, content: 'NEXT_PUBLIC_APP_NAME=' + name }, description: 'Set up environment file', depends_on: [1] },
          { step: 5, tool: 'git', params: { action: 'init', path: `./${name}` }, description: 'Initialize git repository', depends_on: [1] },
          { step: 6, tool: 'git', params: { action: 'add_all', path: `./${name}` }, description: 'Stage all files', depends_on: [5] },
          { step: 7, tool: 'git', params: { action: 'commit', message: 'initial commit: scaffold Next.js project' }, description: 'Initial commit', depends_on: [6] },
        ],
      };
    }

    if (lower.includes('lint') || lower.includes('format') || lower.includes('prettier') || lower.includes('eslint')) {
      return {
        goal: 'Run linter and formatter on the codebase',
        risk_level: 'low',
        requires_approval: false,
        tasks: [
          { step: 1, tool: 'shell', params: { command: 'npm run lint 2>&1 || npx eslint . --ext .ts,.tsx,.js,.jsx' }, description: 'Run ESLint across the project', depends_on: [] },
          { step: 2, tool: 'shell', params: { command: 'npm run format 2>&1 || npx prettier --write "src/**/*.{ts,tsx,js,jsx,json,css,md}"' }, description: 'Run Prettier across the project', depends_on: [] },
          { step: 3, tool: 'git', params: { action: 'status' }, description: 'Show files changed by formatting', depends_on: [1, 2] },
        ],
      };
    }

    if (lower.includes('search') || lower.includes('find') || lower.includes('grep')) {
      const query = intent.replace(/search|find|grep|for|code/gi, '').trim();
      return {
        goal: `Search codebase for "${query}"`,
        risk_level: 'low',
        requires_approval: false,
        tasks: [
          { step: 1, tool: 'global_search', params: { pattern: query, directory: '.' }, description: 'Regex search across codebase', depends_on: [] },
          { step: 2, tool: 'format_report', params: { type: 'search_results', results: '{{step1.output}}' }, description: 'Format results with file names and line numbers', depends_on: [1] },
        ],
      };
    }

    // Default: generic dev research
    return {
      goal: 'Analyze codebase and provide developer assistance',
      risk_level: 'low',
      requires_approval: false,
      tasks: [
        { step: 1, tool: 'shell', params: { command: 'pwd && ls -la' }, description: 'Get current working directory', depends_on: [] },
        { step: 2, tool: 'git', params: { action: 'status' }, description: 'Check git status', depends_on: [] },
        { step: 3, tool: 'list_files', params: { depth: 2 }, description: 'Show project structure', depends_on: [] },
        { step: 4, tool: 'format_report', params: { type: 'project_summary' }, description: 'Summarize findings', depends_on: [1, 2, 3] },
      ],
    };
  }
}

export const devAgent = new DevAgent();
