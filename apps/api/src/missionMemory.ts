/**
 * Nexus OS — Mission Memory
 *
 * Replaces MCPBridge. Key improvements:
 *
 * 1. TYPED entries — agents write TypedArtifacts, not raw strings.
 *    Downstream agents receive structured data they can reason over.
 *
 * 2. SELECTIVE READ — each task declares contextFields (task IDs whose
 *    outputs it needs). Memory builds a focused, structured prompt block
 *    from only those entries — agents don't drown in unrelated context.
 *
 * 3. PERSISTENT — async Supabase flush on every write. On reconnect,
 *    state can be rehydrated from DB instead of being lost.
 *
 * 4. EXPORT COMPAT — retains the export() method from MCPBridge so the
 *    existing /api/export/:sessionId route keeps working.
 */

import type { Response } from 'express';
import type {
  AgentType,
  MemoryEntry,
  TypedArtifact,
  AgentContext,
  ArtifactDepositedEvent,
  ExportFormat,
  LeadListArtifact,
  ResearchArtifact,
  AnalysisArtifact,
  StrategyArtifact,
} from '../../../packages/types/index.js';

// ── Graph Types ─────────────────────────────────────────────────────────────

export type NodeType = 'User' | 'Project' | 'Lead' | 'Document' | 'Decision' | 'Competitor' | 'Artifact';
export type EdgeType = 'derived_from' | 'depends_on' | 'created_by' | 'conflicts_with';

export interface ContextNode {
  id: string;
  type: NodeType;
  content: string;
  metadata?: Record<string, any>;
  createdAt: number;
}

export interface ContextEdge {
  sourceId: string;
  targetId: string;
  relation: EdgeType;
  weight: number;
}

const MAX_MEMORY_ENTRIES = 100; // Reduced from 200
const MAX_CONTEXT_NODES = 150; // Reduced from 250


// ── Supabase (lazy, optional) ──────────────────────────────────────────────

let supabaseClient: unknown = null;

async function getSupabase() {
  if (supabaseClient) return supabaseClient as any;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  try {
    const { createClient } = await import('@supabase/supabase-js');
    supabaseClient = createClient(url, key);
    return supabaseClient as any;
  } catch {
    return null;
  }
}

// ── Export Builders (retained from MCPBridge) ──────────────────────────────

function buildMarkdown(sessionId: string, goal: string, entries: MemoryEntry[]): string {
  const lines = [
    `# Nexus OS — Mission Report`,
    `**Session:** \`${sessionId}\``,
    `**Goal:** ${goal}`,
    `**Generated:** ${new Date().toUTCString()}`,
    `**Agents:** ${entries.length}`,
    '', '---', '',
  ];
  for (const e of entries) {
    const label = e.taskId.replace(/_/g, ' ').toUpperCase();
    lines.push(`## 🤖 ${e.agentType.toUpperCase()} — ${label}`);
    lines.push(`*Tokens: ${e.tokensUsed} · Written: ${new Date(e.writtenAt).toISOString()}*`);
    lines.push('');
    const content = e.data.rawContent ?? JSON.stringify(e.data, null, 2);
    lines.push(content);
    lines.push('', '---', '');
  }
  return lines.join('\n');
}

function buildJSON(sessionId: string, goal: string, entries: MemoryEntry[]): string {
  return JSON.stringify({ nexusOs: '2.0', sessionId, goal, exportedAt: new Date().toISOString(), entries }, null, 2);
}

function buildExcelCSV(entries: MemoryEntry[]): string {
  // Use CSV format with structural awareness for Leads
  const headers = ['Agent', 'Task ID', 'Company/Entity', 'Role/Type', 'Location', 'Value', 'Tokens', 'Timestamp'];
  const rows: string[][] = [];

  for (const e of entries) {
    const data = e.data as any;
    if (data.leads && Array.isArray(data.leads)) {
      for (const lead of data.leads) {
        rows.push([
          e.agentType.toUpperCase(),
          e.taskId,
          `"${(lead.company || lead.name || '').replace(/"/g, '""')}"`,
          `"${(lead.role || lead.niche || '').replace(/"/g, '""')}"`,
          `"${(lead.location || '').replace(/"/g, '""')}"`,
          `"${(lead.painPoint || lead.insight || lead.outreachHook || '').replace(/"/g, '""')}"`,
          e.tokensUsed.toString(),
          new Date(e.writtenAt).toISOString()
        ]);
      }
      continue;
    }

    // Default row for non-list artifacts
    rows.push([
      e.agentType.toUpperCase(),
      e.taskId,
      'N/A',
      'N/A',
      'N/A',
      `"${(data.rawContent || JSON.stringify(data)).replace(/"/g, '""').slice(0, 500)}..."`,
      e.tokensUsed.toString(),
      new Date(e.writtenAt).toISOString()
    ]);
  }

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

function buildPDFHtml(sessionId: string, goal: string, entries: MemoryEntry[]): string {
  const agentSections = entries.map(e => `
    <div class="agent-card">
      <div class="agent-header">
        <span class="agent-type">${e.agentType.toUpperCase()}</span>
        <span class="agent-label">${e.taskId.replace(/_/g, ' ')}</span>
      </div>
      <div class="agent-meta">Agent ID: ${e.taskId} · ${new Date(e.writtenAt).toLocaleString()} · ${e.tokensUsed} tokens</div>
      <div class="agent-content">${(e.data.rawContent || JSON.stringify(e.data, null, 2)).replace(/\n/g, '<br/>')}</div>
    </div>
  `).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/><title>Nexus OS Report — ${sessionId}</title>
<style>
  body { font-family: 'Segoe UI', system-ui, sans-serif; margin: 40px; color: #1a1a2e; background: #fff; }
  h1 { color: #7c6af7; border-bottom: 2px solid #7c6af7; padding-bottom: 12px; font-weight: 800; }
  .meta { color: #64748b; font-size: 13px; margin-bottom: 40px; border-left: 4px solid #e2e8f0; padding-left: 16px; }
  .agent-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 32px; page-break-inside: avoid; }
  .agent-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
  .agent-type { background: #7c6af715; color: #7c6af7; padding: 3px 10px; border-radius: 6px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
  .agent-label { font-weight: 700; font-size: 18px; text-transform: capitalize; }
  .agent-meta { font-size: 11px; color: #94a3b8; margin-bottom: 16px; font-family: ui-monospace, monospace; }
  .agent-content { line-height: 1.6; color: #334155; font-size: 14px; white-space: pre-wrap; }
  @media print { body { margin: 20px; } .agent-card { border: 1px solid #eee; } }
</style>
</head>
<body>
<h1>⬡ Nexus OS — Mission Report</h1>
<div class="meta">
  <strong>Session ID:</strong> <code>${sessionId}</code><br/>
  <strong>Mission Goal:</strong> ${goal}<br/>
  <strong>Timestamp:</strong> ${new Date().toISOString()}
</div>
${agentSections}
</body></html>`;
}


// ── MissionMemory V2 (Graph) ──────────────────────────────────────────────────

export class MissionMemory {
  private store = new Map<string, MemoryEntry>();
  private nodes = new Map<string, ContextNode>();
  private edges = new Map<string, ContextEdge[]>();
  private sessionId: string;
  private goal: string;

  constructor(sessionId: string, goal: string) {
    this.sessionId = sessionId;
    this.goal = goal;

    // Initialize root goal node
    this.addNode({
      id: `goal_${this.sessionId}`,
      type: 'Project',
      content: this.goal,
      createdAt: Date.now(),
    });
  }

  private removeNode(nodeId: string): void {
    this.nodes.delete(nodeId);
    this.edges.delete(nodeId);

    for (const [sourceId, sourceEdges] of this.edges.entries()) {
      this.edges.set(
        sourceId,
        sourceEdges.filter((edge) => edge.targetId !== nodeId)
      );
    }
  }

  private pruneMemory(): void {
    while (this.store.size > MAX_MEMORY_ENTRIES) {
      const oldestEntry = this.store.entries().next().value as [string, MemoryEntry] | undefined;
      if (!oldestEntry) break;

      const [key, entry] = oldestEntry;
      this.store.delete(key);
      this.removeNode(`node_${entry.taskId}`);
    }

    const removableNodes = Array.from(this.nodes.values())
      .filter((node) => !node.id.startsWith('goal_'))
      .sort((a, b) => a.createdAt - b.createdAt);

    for (const node of removableNodes.slice(0, Math.max(0, this.nodes.size - MAX_CONTEXT_NODES))) {
      this.removeNode(node.id);
    }
  }

  // ── Graph Management ─────────────────────────────────────────────────────────

  private addNode(node: ContextNode) {
    this.nodes.set(node.id, node);
    if (!this.edges.has(node.id)) this.edges.set(node.id, []);
  }

  private addEdge(sourceId: string, targetId: string, relation: EdgeType, weight: number = 1.0) {
    let sourceEdges = this.edges.get(sourceId);
    if (!sourceEdges) {
      sourceEdges = [];
      this.edges.set(sourceId, sourceEdges);
    }
    sourceEdges.push({ sourceId, targetId, relation, weight });
  }

  /**
   * Smart context retrieval that traverses the graph
   */
  queryContext(goal: string, nodeTypes: NodeType[], depth = 2): ContextNode[] {
    // Collect specific types starting from root
    // For MVP graph traverse, we just filter by type
    const results: ContextNode[] = [];
    for (const node of this.nodes.values()) {
      if (nodeTypes.includes(node.type)) {
        results.push(node);
      }
    }
    return results;
  }

  /**
   * Transforms the internal context graph into a frontend-friendly format
   * for React-Flow visualization.
   */
  toGraphData(): any {
    const nodes: any[] = [];
    const edges: any[] = [];
 
    // Layout constants
    const X_GAP = 250;
    const Y_GAP = 150;
    let waveIndex = 0;
 
    // 1. Process Nodes
    // We'll arrange them in a simple layout: Goal at top, artifacts below
    const nodeArray = Array.from(this.nodes.values());
    
    nodeArray.forEach((node, i) => {
      const isGoal = node.id.startsWith('goal_');
      
      nodes.push({
        id: node.id,
        type: isGoal ? 'input' : 'default',
        data: { 
          label: node.type === 'Artifact' ? (node.metadata?.taskId || node.id) : node.content,
          agentType: node.metadata?.agentType || 'summarizer',
          status: 'completed', // if it's in memory, it's completed
          artifact: node.content
        },
        position: { 
          x: isGoal ? 400 : (i % 3) * X_GAP, 
          y: isGoal ? 0 : (Math.floor(i / 3) + 1) * Y_GAP 
        },
      });
    });
 
    // 2. Process Edges
    for (const [sourceId, sourceEdges] of this.edges.entries()) {
      for (const edge of sourceEdges) {
        edges.push({
          id: `e_${edge.sourceId}_${edge.targetId}`,
          source: edge.sourceId,
          target: edge.targetId,
          label: edge.relation,
          animated: true,
        });
      }
    }
 
    return { nodes, edges };
  }
 
  /**
   * Inject memory into an agent prompt
   */
  injectMemory(agentPrompt: string, relevantNodes: ContextNode[]): string {
    if (relevantNodes.length === 0) return agentPrompt;
    
    const contextBlock = relevantNodes.map(n => `[${n.type.toUpperCase()}] ${n.content}`).join('\n');
    return `${agentPrompt}\n\n═══ CONTEXT GRAPH ═══\n${contextBlock}\n═════════════════════\n`;
  }


  /**
   * Write a TypedArtifact to memory.
   * Key format: "artifact:{taskId}"
   * Emits SSE artifact_deposited event.
   * Awaits Supabase persistence before emitting the artifact event.
   */
  async write(
    taskId: string,
    agentType: AgentType,
    artifact: TypedArtifact,
    tokensUsed: number,
    sseRes?: Response,
    isAborted: () => boolean = () => false
  ): Promise<void> {
    const key = `artifact:${taskId}`;
    
    // Auto-generate basic semantic tags
    const tags = [agentType, artifact.format];
    if (artifact.format === 'prose' && (artifact as any).keywords) {
       tags.push(...(artifact as any).keywords);
    }

    const entry: MemoryEntry = {
      key,
      taskId,
      agentType,
      data: artifact,
      writtenAt: Date.now(),
      tokensUsed,
      tags,
    };
    this.store.set(key, entry);

    console.log(`[Memory] 📦 Written — ${agentType}:${taskId} (${tokensUsed} tokens) [Tags: ${tags.join(',')}]`);

    // Graph Upkeep: Convert artifact to Graph Node
    const nodeId = `node_${taskId}`;
    this.addNode({
      id: nodeId,
      type: 'Artifact',
      content: artifact.rawContent ?? JSON.stringify(artifact).substring(0, 500),
      createdAt: Date.now(),
      metadata: { agentType, taskId, tags }
    });
    this.addEdge(nodeId, `goal_${this.sessionId}`, 'derived_from', 1.0);
    this.pruneMemory();

    await this.flushToSupabase(key, entry);

    if (sseRes && !isAborted()) {
      const preview = artifact.rawContent?.slice(0, 150) ??
        JSON.stringify(artifact).slice(0, 150);
      const event: ArtifactDepositedEvent = {
        type: 'artifact_deposited',
        agentId: taskId,
        taskLabel: taskId.replace(/_/g, ' '),
        agentType,
        preview,
        tokensUsed,
        depositedAt: new Date().toISOString(),
        outputFormat: artifact.format,
      };
      sseRes.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  }

  /**
   * SELECTIVE READ — the core innovation vs MCPBridge.
   *
   * contextFields is an array of taskIds this agent needs to read.
   * Returns only those entries, formatted as a clean prompt block.
   * If contextFields is empty, returns empty context (parallel/wave-1 tasks).
   */
  selectiveRead(contextFields: string[]): AgentContext {
    if (contextFields.length === 0) {
      return { entries: [], promptBlock: '' };
    }

    const entries: MemoryEntry[] = [];
    const missing: string[] = [];

    for (const field of contextFields) {
      const entry = this.store.get(`artifact:${field}`);
      if (entry) {
        entries.push(entry);
      } else {
        missing.push(field);
        console.warn(`[Memory] selectiveRead: "${field}" not found — task may not have completed yet`);
      }
    }

    const promptBlock = this.buildPromptBlock(entries);
    return { entries, promptBlock };
  }

  /**
   * Build a structured, prompt-ready context block from memory entries.
   * Formats structured_json artifacts as clean JSON, prose as text.
   * Each section is labeled with agent type and task ID.
   */
  private buildPromptBlock(entries: MemoryEntry[]): string {
    if (entries.length === 0) return '';

    const sections = entries.map((e) => {
      const header = `[${e.agentType.toUpperCase()} OUTPUT: ${e.taskId}]`;
      const artifact = e.data;

      if (artifact.format === 'structured_json' || artifact.format === 'list') {
        // Omit rawContent from the prompt — use structured fields only
        const { rawContent: _raw, ...structuredData } = artifact as any;
        return `${header}\n${JSON.stringify(structuredData, null, 2)}`;
      }

      // prose / code
      return `${header}\n${artifact.rawContent ?? JSON.stringify(artifact)}`;
    });

    return (
      '\n\n═══ PRIOR AGENT OUTPUTS (your evidence base) ═══\n\n' +
      sections.join('\n\n────────────────────────\n\n') +
      '\n═══ END PRIOR OUTPUTS ═══\n'
    );
  }

  readAll(): MemoryEntry[] {
    return [...this.store.values()];
  }

  read(taskId: string): MemoryEntry | undefined {
    return this.store.get(`artifact:${taskId}`);
  }

  get size(): number {
    return this.store.size;
  }

  // ── Supabase Persistence ───────────────────────────────────────────────

  private async flushToSupabase(key: string, entry: MemoryEntry): Promise<void> {
    const client = await getSupabase();
    if (!client) return;

    const { error } = await client.from('agent_artifacts').upsert({
      id: `${this.sessionId}:${key}`,
      session_id: this.sessionId,
      task_id: entry.taskId,
      agent_type: entry.agentType,
      artifact_key: key,
      data: entry.data,
      tokens_used: entry.tokensUsed,
      written_at: new Date(entry.writtenAt).toISOString(),
    });

    if (error) {
      console.error('[Memory] Supabase upsert error:', error);
      throw new Error(`Failed to persist mission memory for ${key}.`);
    }
  }

  // ── Export (kept from MCPBridge for /api/export compat) ─────────────────

  export(format: ExportFormat): { content: string; mimeType: string; filename: string } {
    const entries = this.readAll();
    if (entries.length === 0) {
      throw new Error('No artifacts to export. Run an orchestration first.');
    }
    const slug = this.sessionId.slice(0, 8);
    const date = new Date().toISOString().slice(0, 10);

    switch (format) {
      case 'markdown':
        return {
          content: buildMarkdown(this.sessionId, this.goal, entries),
          mimeType: 'text/markdown',
          filename: `nexus-report-${slug}-${date}.md`,
        };
      case 'json':
        return {
          content: buildJSON(this.sessionId, this.goal, entries),
          mimeType: 'application/json',
          filename: `nexus-artifacts-${slug}-${date}.json`,
        };
      case 'excel':
        return {
          content: buildExcelCSV(entries),
          mimeType: 'text/csv',
          filename: `nexus-data-${slug}-${date}.csv`,
        };
      case 'pdf':
        return {
          content: buildPDFHtml(this.sessionId, this.goal, entries),
          mimeType: 'text/html',
          filename: `nexus-report-${slug}-${date}.html`,
        };
      default:
        throw new Error(`Unknown export format: ${format}`);
    }

  }
}
