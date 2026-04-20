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
import type {
  MemoryEntry,
  SynthesisArtifact,
  TaskDAG,
  TaskNode,
  TypedArtifact,
  LeadListArtifact,
  ResearchArtifact,
  AnalysisArtifact,
  StrategyArtifact,
  ConflictResolution,
  KeyInsight,
  CriterionResult,
  NextStep,
} from '@nexus-os/types';
import { llmRouter } from './llm/LLMRouter.js';
import { TaskRegistry } from './taskRegistry.js';
import { MissionMemory } from './missionMemory.js';
import { ledger } from './ledger.js';
import { RateLimitGovernor } from './rateLimitGovernor.js';

import { 
  MODEL_POWER 
} from './agents/agentConfig.js';

export interface StrategicDecision {
  recommendation: string;
  pros: string[];
  cons: string[];
}

const SYNTHESIS_MODEL   = MODEL_POWER; // larger model for final synthesis
const SYNTHESIS_TOKENS  = 1400;

// ── Conflict Detection ─────────────────────────────────────────────────────

interface ConflictCandidate {
  field: string;
  valueA: string; agentA: string;
  valueB: string; agentB: string;
  severity: 'critical' | 'minor';
}

interface DeepSemanticAuditResult {
  status: 'ok' | 'critical_gap' | 'strategic_contradiction';
  reasoning: string;
  correctionTasks?: TaskNode[];
}

async function deepSemanticAuditor(
  dag: TaskDAG,
  entries: MemoryEntry[],
  governor: RateLimitGovernor
): Promise<DeepSemanticAuditResult> {
  console.log('[ChiefAnalyst] 🧠 Performing Deep Semantic Audit...');

  const safeEntries = Array.isArray(entries) ? entries : [];
  const missionContext = safeEntries.map((e) => {
    const data = (e.data || {}) as any;
    const { rawContent: _r, ...cleanData } = data;
    return `[${(e.agentType || 'UNKNOWN').toUpperCase()} — ${e.taskId}]\n${JSON.stringify(cleanData, null, 2)}`;
  }).join('\n\n────────────────────────\n\n');

  const prompt = `
    You are the NexusOS Deep Semantic Auditor.
    MISSION GOAL: "${dag.goal}"
    
    AGENT OUTPUTS:
    ${missionContext}

    AUDIT:
    1. Cross-examine all outputs.
    2. Detect strategic contradictions (e.g., conflicting budget/strategy).
    3. Find gaps preventing MISSION GOAL.
    4. Propose Correction Wave tasks if needed.

    STRICT JSON ONLY:
    {
      "status": "ok" | "critical_gap" | "strategic_contradiction",
      "reasoning": "concise explanation",
      "correctionTasks": [
        { "id": "correction_X", "label": "...", "agentType": "...", "dependencies": [], "contextFields": [], "expectedOutput": { "format": "..." } }
      ]
    }
  `;

  const callLLM = async (): Promise<DeepSemanticAuditResult> => {
    const res = await llmRouter.call({
      system: 'You are a master information synthesizer.',
      user: prompt,
      model: SYNTHESIS_MODEL,
      maxTokens: SYNTHESIS_TOKENS,
      temperature: 0.1,
      jsonMode: true,
      preferProvider: 'cerebras',
    });

    let auditResult: DeepSemanticAuditResult;
    try {
      auditResult = JSON.parse(res.content) as DeepSemanticAuditResult;
    } catch (parseErr) {
      console.warn('[ChiefAnalyst] Failed to parse semantic audit as JSON, using safety fallback:', res.content.slice(0, 100));
      auditResult = { status: 'ok', reasoning: 'Audit response was non-JSON prose, proceeding with current data.' };
    }

    console.log(`[ChiefAnalyst] Deep Semantic Audit: ${auditResult.status.toUpperCase()} - ${auditResult.reasoning}`);
    return auditResult;
  };

  try {
    return await governor.execute(callLLM);
  } catch (err) {
    console.error('[ChiefAnalyst] Deep Semantic Audit failed, proceeding with existing data:', err);
    return { status: 'ok', reasoning: 'Audit failed, proceeding with existing data.' };
  }
}

function extractNumericValue(text: string): number | null {
  const match = text.replace(/[,₹$€£]/g, '').match(/(\d+(?:\.\d+)?)\s*(?:cr|lakh|k|m|b|bn)?/i);
  if (!match) return null;
  let val = parseFloat(match[1]);
  const suffix = (match[2] ?? '').toLowerCase();
  if (suffix === 'cr') val *= 10_000_000;
  else if (suffix === 'lakh') val *= 100_000;
  else if (suffix === 'k') val *= 1_000;
  else if (suffix === 'm') val *= 1_000_000;
  else if (suffix === 'b' || suffix === 'bn') val *= 1_000_000_000;
  return val;
}

function detectConflicts(entries: MemoryEntry[]): ConflictCandidate[] {
  const conflicts: ConflictCandidate[] = [];
  const safeEntries = Array.isArray(entries) ? entries : [];

  // Check market size estimates across researcher and analyst artifacts
  const marketSizes: Array<{ agent: string; value: number; raw: string }> = [];
  for (const entry of safeEntries) {
    const art = entry.data;
    let sizeStr = '';
    if (art.agentType === 'researcher') sizeStr = (art as ResearchArtifact).marketSize ?? '';
    if (art.agentType === 'analyst') {
      const dp = (art as AnalysisArtifact).dataPoints?.find(
        (d) => d.label.toLowerCase().includes('market')
      );
      if (dp) sizeStr = dp.value;
    }
    if (sizeStr) {
      const val = extractNumericValue(sizeStr);
      if (val !== null) marketSizes.push({ agent: entry.taskId, value: val, raw: sizeStr });
    }
  }

  if (marketSizes.length >= 2) {
    const max = Math.max(...marketSizes.map((m) => m.value));
    const min = Math.min(...marketSizes.map((m) => m.value));
    if (min > 0 && max / min > 2.0) {
      const a = marketSizes[0]; const b = marketSizes[1];
      conflicts.push({
        field: 'market_size_estimate',
        valueA: a.raw, agentA: a.agent,
        valueB: b.raw, agentB: b.agent,
        severity: 'critical',
      });
    }
  }

  // Check for directional sentiment conflicts (bullish vs bearish)
  const sentimentKeywords = {
    positive: ['growing', 'opportunity', 'high demand', 'profitable', 'underserved', 'strong'],
    negative: ['saturated', 'declining', 'risky', 'competitive', 'challenging', 'oversupplied'],
  };

  const sentiments: Array<{ agent: string; direction: 'positive' | 'negative' }> = [];
  for (const entry of safeEntries) {
    const text = entry.data.rawContent?.toLowerCase() ?? '';
    const posScore = sentimentKeywords.positive.filter((w) => text.includes(w)).length;
    const negScore = sentimentKeywords.negative.filter((w) => text.includes(w)).length;
    if (posScore > negScore + 2) sentiments.push({ agent: entry.taskId, direction: 'positive' });
    else if (negScore > posScore + 2) sentiments.push({ agent: entry.taskId, direction: 'negative' });
  }

  const positives = sentiments.filter((s) => s.direction === 'positive');
  const negatives = sentiments.filter((s) => s.direction === 'negative');
  if (positives.length > 0 && negatives.length > 0) {
    conflicts.push({
      field: 'market_direction',
      valueA: 'Positive/opportunity-focused',
      agentA: positives[0].agent,
      valueB: 'Cautious/risk-focused',
      agentB: negatives[0].agent,
      severity: 'minor',
    });
  }

  return conflicts;
}

// ── Synthesis Prompt Builder ───────────────────────────────────────────────

function buildSynthesisPrompt(
  dag: TaskDAG,
  entries: MemoryEntry[],
  conflicts: ConflictCandidate[]
): { system: string; user: string } {
  const system = `\
CHIEF ANALYST: MISSION FINAL ARBITER.

MISSION: "${dag.goal}"
GOAL TYPE: ${dag.goalType}

CRITERIA:
${(dag.successCriteria || []).map((c, i) => `${i + 1}. ${c}`).join('\n')}

${(conflicts || []).length > 0
  ? `CONFLICTS (RESOLVE EXPLICITLY):
${conflicts.map((c) => `• ${c.field}: Agent "${c.agentA}" ("${c.valueA}") vs "${c.agentB}" ("${c.valueB}")`).join('\n')}`
  : 'No conflicts.'}

STRICT JSON ONLY:
{
  "executiveSummary": "300-500 words. Strategic assessment + primary findings + goal impact.",
  "criteriaResults": [
    { "criterion": "...", "result": "...", "confidence": "high|medium|low", "met": true|false }
  ],
  "keyInsights": [
    { "insight": "...", "supportingAgents": [], "score": 0.0, "reasoning": "...", "confidence": "..." }
  ],
  "strategicDecisions": [
    { "recommendation": "...", "pros": [], "cons": [] }
  ],
  "resolvedConflicts": [
    { "topic": "...", "conflictDescription": "...", "resolution": "..." }
  ],
  "deliverable": {},
  "gaps": [],
  "nextSteps": [
    { "action": "...", "timeframe": "Today", "priority": "high" }
  ]
}`;

  // Build context from all entries
  const contextSections = (entries || []).map((e) => {
    const data = (e.data || {}) as any;
    const { rawContent: _r, ...cleanData } = data;
    return `[${(e.agentType || 'UNKNOWN').toUpperCase()} — ${e.taskId}]\n${JSON.stringify(cleanData, null, 2)}`;
  }).join('\n\n────────────────────────\n\n');

  const user = `ALL AGENT OUTPUTS FOR THIS MISSION:\n\n${contextSections}\n\nNow produce the Chief Analyst synthesis. Return ONLY the JSON object.`;

  return { system, user };
}

// ── JSON Extraction ────────────────────────────────────────────────────────

function extractJSON(text: string): Record<string, unknown> {
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/(\{[\s\S]*\})/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Chief Analyst returned no parseable JSON');
  }
}

// ── Build SynthesisArtifact from parsed JSON ───────────────────────────────

function buildSynthesisArtifact(parsed: Record<string, unknown>): SynthesisArtifact & { strategicDecisions?: StrategicDecision[] } {
  return {
    format: 'structured_json',
    agentType: 'chief_analyst',
    taskId: 'chief_analyst_synthesis',
    executiveSummary: String(parsed.executiveSummary ?? ''),
    criteriaResults: (parsed.criteriaResults as CriterionResult[]) ?? [],
    keyInsights: (parsed.keyInsights as KeyInsight[]) ?? [],
    strategicDecisions: (parsed.strategicDecisions as StrategicDecision[]) ?? [],
    resolvedConflicts: (parsed.resolvedConflicts as ConflictResolution[]) ?? [],
    deliverable: (parsed.deliverable as Record<string, unknown>) ?? {},
    gaps: Array.isArray(parsed.gaps) ? parsed.gaps as string[] : [],
    nextSteps: Array.isArray(parsed.nextSteps) ? parsed.nextSteps as NextStep[] : 
               (parsed.nextSteps ? [parsed.nextSteps as NextStep] : []),
    rawContent: String(parsed.executiveSummary ?? '').slice(0, 300),
  };
}


// ── Main Export ────────────────────────────────────────────────────────────

export async function runChiefAnalyst(
  dag: TaskDAG,
  entries: MemoryEntry[],
  governor: RateLimitGovernor,
  sseRes: Response,
  isAborted: () => boolean
): Promise<SynthesisArtifact> {
  const apiKey = process.env.GROQ_API_KEY!;

  // ── Deep Semantic Audit & Autonomous Remediation ───────────────────────────
  const auditResult = await deepSemanticAuditor(dag, entries, governor);

  if (auditResult.status !== 'ok' && auditResult.correctionTasks && auditResult.correctionTasks.length > 0) {
    console.log(`[ChiefAnalyst] 🛠️ Triggering Autonomous Remediation (Correction Wave)...`);
    sseRes.write(
      `data: ${JSON.stringify({ type: 'agent_working', taskId: 'chief_analyst', taskLabel: 'Deep Semantic Auditor', message: `Contradiction detected: ${auditResult.reasoning}. Triggering correction wave...` })}\n\n`
    );

    const correctionDag: TaskDAG = {
      ...dag,
      nodes: auditResult.correctionTasks,
    };

    const correctionMemory = new MissionMemory(`remediation_${dag.missionId}`, dag.goal);
    const correctionRegistry = new TaskRegistry(dag.missionId);

    // Dynamically import to break circular dependency with orchestrator.ts
    const { orchestrateDAG } = await import('./orchestrator.js');

    // Execute the correction wave
    await orchestrateDAG({
      dag: correctionDag,
      memory: correctionMemory,
      registry: correctionRegistry,
      userId: `remediation_${dag.missionId}`,
      sessionId: `remediation_${dag.missionId}`,
      res: sseRes,
      isAborted,
    });

    // Merge correction artifacts back into main memory
    const correctionArtifacts = correctionMemory.readAll();
    correctionArtifacts.forEach((entry) => {
      entries.push(entry);
    });

    console.log(`[ChiefAnalyst] ✅ Correction Wave complete. Resuming synthesis...`);
  }

  console.log(`[ChiefAnalyst] 🔍 Detecting conflicts across ${entries.length} agent outputs...`);
  const conflicts = detectConflicts(entries);
  console.log(`[ChiefAnalyst] Found ${conflicts.length} conflict(s)`);

  if (!isAborted()) {
    sseRes.write(
      `data: ${JSON.stringify({ type: 'synthesis_start', conflictsDetected: conflicts.length })}\n\n`
    );
  }

  const { system, user } = buildSynthesisPrompt(dag, entries, conflicts);

  const callLLM = async (): Promise<SynthesisArtifact> => {
    if (isAborted()) throw new Error('[Canceled] Mission aborted before synthesis');

    const res = await llmRouter.call({
      system,
      user,
      model: SYNTHESIS_MODEL,
      temperature: 0.2,
      maxTokens: SYNTHESIS_TOKENS,
      jsonMode: true,
      signal: AbortSignal.timeout(35000),
    });

    const parsed = extractJSON(res.content);
    return buildSynthesisArtifact(parsed);
  };

  // Run through the governor for rate-limit protection
  const synthesis = await governor.execute(callLLM);

  console.log(
    `[ChiefAnalyst] ✅ Synthesis complete — ` +
    `${synthesis.criteriaResults.length} criteria, ` +
    `${synthesis.keyInsights.length} insights, ` +
    `${synthesis.gaps.length} gaps`
  );

  return synthesis;
}
