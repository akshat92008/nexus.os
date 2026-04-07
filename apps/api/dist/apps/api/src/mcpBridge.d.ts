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
import type { Artifact, ExportFormat } from '../../../packages/types/index.js';
export declare class MCPBridge {
    private store;
    private sessionId;
    private goal;
    /** Called at the start of each orchestration to set context */
    init(sessionId: string, goal: string): void;
    /**
     * DEPOSIT — parallel agents call this on completion.
     * Fires artifact_deposited SSE event if the socket is alive.
     */
    deposit(agentId: string, artifact: Artifact, sseRes?: Response, isAborted?: () => boolean): void;
    /**
     * HANDOFF — called just before sequential agents begin.
     * Fires a handoff SSE event if the socket is alive.
     */
    announceHandoff(toAgentId: string, sseRes?: Response, isAborted?: () => boolean): void;
    /** Returns all deposited artifacts for sequential agents to read */
    retrieveAll(): Artifact[];
    /** Returns a single artifact by agentId */
    retrieve(agentId: string): Artifact | undefined;
    get size(): number;
    /**
     * Merges all deposited artifacts into an exportable format.
     * Called by GET /api/export/:sessionId?format=markdown|json|pdf
     */
    export(format: ExportFormat): {
        content: string;
        mimeType: string;
        filename: string;
    };
}
//# sourceMappingURL=mcpBridge.d.ts.map