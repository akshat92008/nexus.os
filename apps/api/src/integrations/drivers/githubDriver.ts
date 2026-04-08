import { Tool } from '../types.js';

export const githubDriver: Tool = {
  id:               'github_rest',
  name:             'GitHub REST API',
  description:      'Interact with GitHub REST API (create issues, list issues, create PRs)',
  category:         'code',
  riskLevel:        'high',
  requiresApproval: true,
  paramSchema: {
    repo:   { type: 'string', required: true,  description: 'GitHub repo (owner/repo)' },
    action: { type: 'string', required: true,  description: 'Action: create_issue, list_issues, create_pr' },
    title:  { type: 'string', required: false, description: 'Title for issue or PR' },
    body:   { type: 'string', required: false, description: 'Body for issue or PR' },
    head:   { type: 'string', required: false, description: 'Head branch for PR' },
    base:   { type: 'string', required: false, description: 'Base branch for PR (default: main)' },
  },
  validate: (p) => {
    if (!p.repo) return 'Missing required param: repo';
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(p.repo as string)) return 'Repo must match owner/repo format.';
    if (!['create_issue', 'list_issues', 'create_pr'].includes(p.action as string)) return 'Invalid action.';
    if ((p.action === 'create_issue' || p.action === 'create_pr') && !p.title) return 'Title is required for this action.';
    if (p.action === 'create_pr' && !p.head) return 'Head branch is required for creating a PR.';
    return null;
  },
  execute: async (params) => {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error('GITHUB_TOKEN is not configured on the server.');
    }

    const { repo, action, title, body, head, base = 'main' } = params;
    let url = `https://api.github.com/repos/${repo}`;
    let method = 'GET';
    let payload: any = null;

    if (action === 'create_issue') {
      url += '/issues';
      method = 'POST';
      payload = { title, body };
    } else if (action === 'list_issues') {
      url += '/issues';
      method = 'GET';
    } else if (action === 'create_pr') {
      url += '/pulls';
      method = 'POST';
      payload = { title, body, head, base };
    }

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'Nexus-OS-Agent',
        },
        body: payload ? JSON.stringify(payload) : undefined,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`GitHub API error (${response.status}): ${errorData.message || response.statusText}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        data: {
          action,
          repo,
          result: data,
        },
        timestamp: Date.now(),
      };
    } catch (err: any) {
      console.error('[GitHubDriver] execution failed:', err);
      return {
        success: false,
        error: err.message || 'Failed to execute GitHub action',
      };
    }
  },
};
