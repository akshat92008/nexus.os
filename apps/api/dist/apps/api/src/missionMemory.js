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
// ── Supabase (lazy, optional) ──────────────────────────────────────────────
let supabaseClient = null;
async function getSupabase() {
    if (supabaseClient)
        return supabaseClient;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key)
        return null;
    try {
        const { createClient } = await import('@supabase/supabase-js');
        supabaseClient = createClient(url, key);
        return supabaseClient;
    }
    catch {
        return null;
    }
}
// ── Export Builders (retained from MCPBridge) ──────────────────────────────
function buildMarkdown(sessionId, goal, entries) {
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
function buildJSON(sessionId, goal, entries) {
    return JSON.stringify({ nexusOs: '2.0', sessionId, goal, exportedAt: new Date().toISOString(), entries }, null, 2);
}
function buildExcelCSV(entries) {
    // Use CSV format with structural awareness for Leads
    const headers = ['Agent', 'Task ID', 'Company/Entity', 'Role/Type', 'Location', 'Value', 'Tokens', 'Timestamp'];
    const rows = [];
    for (const e of entries) {
        const data = e.data;
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
function buildPDFHtml(sessionId, goal, entries) {
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
    store = new Map();
    nodes = new Map();
    edges = new Map();
    sessionId;
    goal;
    constructor(sessionId, goal) {
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
    // ── Graph Management ─────────────────────────────────────────────────────────
    addNode(node) {
        this.nodes.set(node.id, node);
        if (!this.edges.has(node.id))
            this.edges.set(node.id, []);
    }
    addEdge(sourceId, targetId, relation, weight = 1.0) {
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
    queryContext(goal, nodeTypes, depth = 2) {
        // Collect specific types starting from root
        // For MVP graph traverse, we just filter by type
        const results = [];
        for (const node of this.nodes.values()) {
            if (nodeTypes.includes(node.type)) {
                results.push(node);
            }
        }
        return results;
    }
    /**
     * Inject memory into an agent prompt
     */
    injectMemory(agentPrompt, relevantNodes) {
        if (relevantNodes.length === 0)
            return agentPrompt;
        const contextBlock = relevantNodes.map(n => `[${n.type.toUpperCase()}] ${n.content}`).join('\n');
        return `${agentPrompt}\n\n═══ CONTEXT GRAPH ═══\n${contextBlock}\n═════════════════════\n`;
    }
    /**
     * Write a TypedArtifact to memory.
     * Key format: "artifact:{taskId}"
     * Emits SSE artifact_deposited event.
     * Fires async Supabase flush (non-blocking).
     */
    write(taskId, agentType, artifact, tokensUsed, sseRes, isAborted = () => false) {
        const key = `artifact:${taskId}`;
        const entry = {
            key,
            taskId,
            agentType,
            data: artifact,
            writtenAt: Date.now(),
            tokensUsed,
        };
        this.store.set(key, entry);
        console.log(`[Memory] 📦 Written — ${agentType}:${taskId} (${tokensUsed} tokens)`);
        // SSE notification
        if (sseRes && !isAborted()) {
            const preview = artifact.rawContent?.slice(0, 150) ??
                JSON.stringify(artifact).slice(0, 150);
            const event = {
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
        // Async Supabase flush — never blocks the pipeline
        this.flushToSupabase(key, entry).catch((err) => console.warn(`[Memory] Supabase flush failed for ${key}:`, err));
        // Graph Upkeep: Convert artifact to Graph Node
        const nodeId = `node_${taskId}`;
        this.addNode({
            id: nodeId,
            type: 'Artifact',
            content: artifact.rawContent ?? JSON.stringify(artifact).substring(0, 500),
            createdAt: Date.now(),
            metadata: { agentType, taskId }
        });
        this.addEdge(nodeId, `goal_${this.sessionId}`, 'derived_from', 1.0);
    }
    /**
     * SELECTIVE READ — the core innovation vs MCPBridge.
     *
     * contextFields is an array of taskIds this agent needs to read.
     * Returns only those entries, formatted as a clean prompt block.
     * If contextFields is empty, returns empty context (parallel/wave-1 tasks).
     */
    selectiveRead(contextFields) {
        if (contextFields.length === 0) {
            return { entries: [], promptBlock: '' };
        }
        const entries = [];
        const missing = [];
        for (const field of contextFields) {
            const entry = this.store.get(`artifact:${field}`);
            if (entry) {
                entries.push(entry);
            }
            else {
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
    buildPromptBlock(entries) {
        if (entries.length === 0)
            return '';
        const sections = entries.map((e) => {
            const header = `[${e.agentType.toUpperCase()} OUTPUT: ${e.taskId}]`;
            const artifact = e.data;
            if (artifact.format === 'structured_json' || artifact.format === 'list') {
                // Omit rawContent from the prompt — use structured fields only
                const { rawContent: _raw, ...structuredData } = artifact;
                return `${header}\n${JSON.stringify(structuredData, null, 2)}`;
            }
            // prose / code
            return `${header}\n${artifact.rawContent ?? JSON.stringify(artifact)}`;
        });
        return ('\n\n═══ PRIOR AGENT OUTPUTS (your evidence base) ═══\n\n' +
            sections.join('\n\n────────────────────────\n\n') +
            '\n═══ END PRIOR OUTPUTS ═══\n');
    }
    readAll() {
        return [...this.store.values()];
    }
    read(taskId) {
        return this.store.get(`artifact:${taskId}`);
    }
    get size() {
        return this.store.size;
    }
    // ── Supabase Persistence ───────────────────────────────────────────────
    async flushToSupabase(key, entry) {
        const client = await getSupabase();
        if (!client)
            return;
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
        }
    }
    // ── Export (kept from MCPBridge for /api/export compat) ─────────────────
    export(format) {
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
//# sourceMappingURL=missionMemory.js.map