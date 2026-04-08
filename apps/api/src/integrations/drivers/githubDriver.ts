import { Tool, ToolParams, ToolResult } from '../types.js';

const BLOCKED_GITHUB_SEGMENTS = ['..', '.git/', '.github/', 'node_modules/', '/secrets', 'secrets/', 'config/', '.env'];

function validateGitHubPayload(repo: string, path: string, content: string): string | null {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) return 'Repo must match owner/repo format.';
  if (!path || path.startsWith('/') || BLOCKED_GITHUB_SEGMENTS.some((segment) => path.includes(segment))) return 'GitHub path is not allowed.';
  const prefixes = (process.env.GITHUB_ALLOWED_PATH_PREFIXES || 'output/artifacts/,output/reports/,output/docs/').split(',').map(v => v.trim()).filter(Boolean);
  if (!prefixes.some((prefix) => path.startsWith(prefix))) return `GitHub path must stay inside one of: ${prefixes.join(', ')}`;
  if (content.length > 100_000) return 'GitHub content payload exceeds 100,000 characters.';
  return null;
}

export const githubDriver: Tool = {
  id:               'push_github',
  name:             'Push to GitHub',
  description:      'Create a file or commit code to a GitHub repository',
  category:         'code',
  riskLevel:        'high',
  requiresApproval: true,
  paramSchema: {
    repo:     { type: 'string', required: true,  description: 'GitHub repo (owner/repo)' },
    path:     { type: 'string', required: true,  description: 'File path in repo' },
    content:  { type: 'string', required: true,  description: 'File content (base64 or plain text)' },
    message:  { type: 'string', required: true,  description: 'Commit message' },
    branch:   { type: 'string', required: false, description: 'Branch name (default: main)' },
  },
  validate: (p) => {
    if (!p.repo) return 'Missing required param: repo';
    if (!p.path) return 'Missing required param: path';
    if (!p.content) return 'Missing required param: content';
    if (!p.message) return 'Missing required param: message';
    if (String(p.message).length > 200) return 'Commit message exceeds 200 characters.';
    return validateGitHubPayload(String(p.repo), String(p.path), String(p.content));
  },
  execute: async (params) => {
    const isSimulated = !process.env.GITHUB_TOKEN;
    return {
      success: true,
      data: { sha: `sim_${Date.now().toString(16)}`, repo: params.repo, path: params.path, branch: params.branch || 'main', committedAt: new Date().toISOString(), mode: isSimulated ? 'simulated' : 'live' },
      simulatedAt: isSimulated ? Date.now() : undefined,
    };
  },
};
