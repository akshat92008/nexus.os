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
import type { AgentType, MemoryEntry, TypedArtifact, AgentContext, ExportFormat } from '../../../packages/types/index.js';
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
export declare class MissionMemory {
    private store;
    private nodes;
    private edges;
    private sessionId;
    private goal;
    constructor(sessionId: string, goal: string);
    private addNode;
    private addEdge;
    /**
     * Smart context retrieval that traverses the graph
     */
    queryContext(goal: string, nodeTypes: NodeType[], depth?: number): ContextNode[];
    /**
     * Inject memory into an agent prompt
     */
    injectMemory(agentPrompt: string, relevantNodes: ContextNode[]): string;
    /**
     * Write a TypedArtifact to memory.
     * Key format: "artifact:{taskId}"
     * Emits SSE artifact_deposited event.
     * Fires async Supabase flush (non-blocking).
     */
    write(taskId: string, agentType: AgentType, artifact: TypedArtifact, tokensUsed: number, sseRes?: Response, isAborted?: () => boolean): void;
    /**
     * SELECTIVE READ — the core innovation vs MCPBridge.
     *
     * contextFields is an array of taskIds this agent needs to read.
     * Returns only those entries, formatted as a clean prompt block.
     * If contextFields is empty, returns empty context (parallel/wave-1 tasks).
     */
    selectiveRead(contextFields: string[]): AgentContext;
    /**
     * Build a structured, prompt-ready context block from memory entries.
     * Formats structured_json artifacts as clean JSON, prose as text.
     * Each section is labeled with agent type and task ID.
     */
    private buildPromptBlock;
    readAll(): MemoryEntry[];
    read(taskId: string): MemoryEntry | undefined;
    get size(): number;
    private flushToSupabase;
    export(format: ExportFormat): {
        content: string;
        mimeType: string;
        filename: string;
    };
}
//# sourceMappingURL=missionMemory.d.ts.map