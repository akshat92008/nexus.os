/**
 * Nexus OS — Chief Analyst (Synthesis Engine)
 *
 * The mandatory final stage of every mission. Responsibilities:
 *
 * 1. CONFLICT DETECTION — programmatically scans all agent artifacts
 *    for numeric discrepancies and directional contradictions.
 *
 * 2. INTEGRATION — builds a unified understanding from all typed artifacts,
 *    weighting insights by: multi-agent confirmation, goal relevance, confidence.
 *
 * 3. CRITERIA VALIDATION — checks every success criterion from the TaskDAG.
 *    Gaps are reported explicitly rather than silently omitted.
 *
 * 4. STRUCTURED OUTPUT — always produces a SynthesisArtifact (typed, not prose)
 *    that the OutputFormatter can validate against domain rules.
 *
 * 5. QUALITY GATE — if the synthesis fails schema validation, triggers a single
 *    targeted correction call before giving up.
 */
import type { Response } from 'express';
import type { MemoryEntry, SynthesisArtifact, TaskDAG } from '../../../packages/types/index.js';
import type { RateLimitGovernor } from './rateLimitGovernor.js';
export interface StrategicDecision {
    recommendation: string;
    pros: string[];
    cons: string[];
}
export declare function runChiefAnalyst(dag: TaskDAG, entries: MemoryEntry[], governor: RateLimitGovernor, sseRes: Response, isAborted: () => boolean): Promise<SynthesisArtifact>;
//# sourceMappingURL=chiefAnalyst.d.ts.map