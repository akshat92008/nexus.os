/**
 * Nexus OS — MCP Bridge (Pillar 3 · Universal File System)
 *
 * Implements the Model Context Protocol handoff layer:
 *   • Parallel agents DEPOSIT artifacts here on completion
 *   • Sequential agents RETRIEVE the full context to build on it
 *   • The bridge fires SSE events so the frontend shows live handoffs
 *   • An export hook lets the frontend pull a merged artifact as
 *     Markdown, JSON, or PDF-ready HTML
 *
 * In production, the Supabase flush writes the final artifact to the
 * `agent_artifacts` table so it persists across sessions.
 */

import type { Response } from 'express';
import type {
  Artifact,
  ArtifactDepositedEvent,
  HandoffEvent,
  ExportFormat,
} from '@nexus-os/types';

// ── Export Builders ────────────────────────────────────────────────────────

function buildMarkdown(sessionId: string, goal: string, artifacts: Artifact[]): string {
  const date = new Date().toUTCString();
  const lines: string[] = [
    `# Nexus OS — Mission Report`,
    `**Session:** \`${sessionId}\`  `,
    `**Goal:** ${goal}  `,
    `**Generated:** ${date}`,
    `**Agents:** ${artifacts.length}`,
    '',
    '---',
    '',
  ];

  for (const artifact of artifacts) {
    lines.push(`## 🤖 ${artifact.agentType.toUpperCase()} — ${artifact.taskLabel}`);
    lines.push(`*Agent ID: \`${artifact.agentId}\` · Deposited: ${artifact.depositedAt} · Tokens: ${artifact.tokensUsed}*`);
    lines.push('');
    lines.push(artifact.content);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

function buildJSON(sessionId: string, goal: string, artifacts: Artifact[]): string {
  return JSON.stringify(
    {
      nexusOs: '1.0',
      sessionId,
      goal,
      exportedAt: new Date().toISOString(),
      agentCount: artifacts.length,
      artifacts,
    },
    null,
    2
  );
}

function buildExcelCSV(artifacts: Artifact[]): string {
  // Use CSV format which Excel opens natively.
  const headers = ['Agent', 'Task Label', 'Company/Entity', 'Role/Type', 'Location', 'Value', 'Tokens', 'Timestamp'];
  const rows: string[][] = [];

  for (const a of artifacts) {
    try {
      // Try to parse as structured lead data first
      const data = JSON.parse(a.content);
      if (data.leads && Array.isArray(data.leads)) {
        for (const lead of data.leads) {
          rows.push([
            a.agentType.toUpperCase(),
            `"${a.taskLabel.replace(/"/g, '""')}"`,
            `"${(lead.company || lead.name || '').replace(/"/g, '""')}"`,
            `"${(lead.role || lead.niche || '').replace(/"/g, '""')}"`,
            `"${(lead.location || '').replace(/"/g, '""')}"`,
            `"${(lead.painPoint || lead.insight || lead.outreachHook || '').replace(/"/g, '""')}"`,
            a.tokensUsed.toString(),
            a.depositedAt
          ]);
        }
        continue;
      }
    } catch (e) {
      // Not JSON or doesn't have leads, fallback to summary row
    }

    // Fallback row for prose or non-lead artifacts
    rows.push([
      a.agentType.toUpperCase(),
      `"${a.taskLabel.replace(/"/g, '""')}"`,
      'N/A',
      'N/A',
      'N/A',
      `"${a.content.replace(/"/g, '""').slice(0, 500)}..."`,
      a.tokensUsed.toString(),
      a.depositedAt
    ]);
  }

  return [
    headers.join(','),
    ...rows.map(r => r.join(','))
  ].join('\n');
}



function buildPDFHtml(sessionId: string, goal: string, artifacts: Artifact[]): string {
  const agentSections = artifacts
    .map(
      (a) => `
      <div class="agent-card">
        <div class="agent-header">
          <span class="agent-type">${a.agentType.toUpperCase()}</span>
          <span class="agent-label">${a.taskLabel}</span>
        </div>
        <div class="agent-meta">Agent: ${a.agentId} · ${a.depositedAt} · ${a.tokensUsed} tokens</div>
        <div class="agent-content">${a.content.replace(/\n/g, '<br/>')}</div>
      </div>`
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Nexus OS Report — ${sessionId}</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 40px; color: #1a1a2e; }
  h1 { color: #7c6af7; border-bottom: 2px solid #7c6af7; padding-bottom: 8px; }
  .meta { color: #64748b; font-size: 13px; margin-bottom: 32px; }
  .agent-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 24px; }
  .agent-header { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
  .agent-type { background: #7c6af720; color: #7c6af7; padding: 2px 10px; border-radius: 99px; font-size: 11px; font-weight: 700; letter-spacing: 1px; }
  .agent-label { font-weight: 600; font-size: 16px; }
  .agent-meta { font-size: 11px; color: #94a3b8; margin-bottom: 12px; font-family: monospace; }
  .agent-content { line-height: 1.7; white-space: pre-wrap; }
  @media print { body { margin: 20px; } }
</style>
</head>
<body>
<h1>⬡ Nexus OS — Mission Report</h1>
<div class="meta">
  Session: <code>${sessionId}</code> &nbsp;·&nbsp;
  Goal: <strong>${goal}</strong> &nbsp;·&nbsp;
  ${new Date().toUTCString()}
</div>
${agentSections}
</body>
</html>`;
}

// ── MCP Bridge Class ───────────────────────────────────────────────────────

export class MCPBridge {
  private store: Map<string, Artifact> = new Map();
  private sessionId: string = '';
  private goal: string = '';

  /** Called at the start of each orchestration to set context */
  init(sessionId: string, goal: string): void {
    this.store.clear();
    this.sessionId = sessionId;
    this.goal = goal;
    console.log(`[MCP] 🧹 Bridge initialized — session: ${sessionId}`);
  }

  /**
   * DEPOSIT — parallel agents call this on completion.
   * Fires artifact_deposited SSE event if the socket is alive.
   */
  deposit(agentId: string, artifact: Artifact, sseRes?: Response, isAborted: () => boolean = () => false): void {
    this.store.set(agentId, artifact);

    console.log(
      `[MCP] 📦 Deposited — agent: ${agentId} (${artifact.agentType}) ` +
      `· ${artifact.tokensUsed} tokens`
    );

    if (sseRes && !isAborted()) {
      const event: ArtifactDepositedEvent = {
        type: 'artifact_deposited',
        agentId,
        taskLabel: artifact.taskLabel,
        agentType: artifact.agentType,
        preview: artifact.content.slice(0, 150),
        tokensUsed: artifact.tokensUsed,
        depositedAt: artifact.depositedAt,
      };
      sseRes.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  }

  /**
   * HANDOFF — called just before sequential agents begin.
   * Fires a handoff SSE event if the socket is alive.
   */
  announceHandoff(toAgentId: string, sseRes?: Response, isAborted: () => boolean = () => false): void {
    const fromAgents = Array.from(this.store.keys());

    if (sseRes && !isAborted() && fromAgents.length > 0) {
      const event: HandoffEvent = {
        type: 'handoff',
        fromAgentId: fromAgents.join(', '),
        toAgentId,
        artifactCount: this.store.size,
      };
      sseRes.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  }

  /** Returns all deposited artifacts for sequential agents to read */
  retrieveAll(): Artifact[] {
    return Array.from(this.store.values());
  }

  /** Returns a single artifact by agentId */
  retrieve(agentId: string): Artifact | undefined {
    return this.store.get(agentId);
  }

  get size(): number {
    return this.store.size;
  }

  // ── Export Hook (Pillar 3 · OS File System) ──────────────────────────────

  /**
   * Merges all deposited artifacts into an exportable format.
   * Called by GET /api/export/:sessionId?format=markdown|json|pdf
   */
  export(format: ExportFormat): { content: string; mimeType: string; filename: string } {
    const artifacts = this.retrieveAll();

    if (artifacts.length === 0) {
      throw new Error('No artifacts to export. Run an orchestration first.');
    }

    const sessionSlug = this.sessionId.slice(0, 8);
    const timestamp   = new Date().toISOString().slice(0, 10);

    switch (format) {
      case 'markdown':
        return {
          content: buildMarkdown(this.sessionId, this.goal, artifacts),
          mimeType: 'text/markdown',
          filename: `nexus-report-${sessionSlug}-${timestamp}.md`,
        };

      case 'json':
        return {
          content: buildJSON(this.sessionId, this.goal, artifacts),
          mimeType: 'application/json',
          filename: `nexus-artifacts-${sessionSlug}-${timestamp}.json`,
        };

      case 'pdf':
        // Returns PDF-ready HTML; client-side or puppeteer can convert
        return {
          content: buildPDFHtml(this.sessionId, this.goal, artifacts),
          mimeType: 'text/html',
          filename: `nexus-report-${sessionSlug}-${timestamp}.html`,
        };

      case 'excel':
        return {
          content: buildExcelCSV(artifacts),
          mimeType: 'text/csv',
          filename: `nexus-data-${sessionSlug}-${timestamp}.csv`,
        };

      default:
        throw new Error(`Unknown export format: ${format}`);
    }

  }
}
