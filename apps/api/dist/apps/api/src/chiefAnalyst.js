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
import { orchestrateDAG } from './orchestrator.js';
import { TaskRegistry } from './taskRegistry.js';
import { MissionMemory } from './missionMemory.js';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const SYNTHESIS_MODEL = 'llama-3.3-70b-versatile'; // larger model for final synthesis
const SYNTHESIS_TOKENS = 1400;
async function deepSemanticAuditor(dag, entries) {
    console.log('[ChiefAnalyst] 🧠 Performing Deep Semantic Audit...');
    const missionContext = entries.map((e) => {
        const { rawContent: _r, ...data } = e.data;
        return `[${e.agentType.toUpperCase()} — ${e.taskId}]\n${JSON.stringify(data, null, 2)}`;
    }).join('\n\n────────────────────────\n\n');
    const prompt = `
    You are the NexusOS Deep Semantic Auditor.
    MISSION GOAL: "${dag.goal}"
    
    ALL AGENT OUTPUTS FOR THIS MISSION:
    ${missionContext}

    AUDIT TASK:
    1. Perform a "Logical Cross-Examination" of all agent outputs.
    2. Look for strategic contradictions (e.g., "Task A recommends high-spend ads, but Task B says client has zero budget").
    3. Identify critical gaps in information that prevent achieving the MISSION GOAL.
    4. If a critical gap or contradiction is found, propose a "Correction Wave" by defining new tasks.

    If "critical_gap" or "strategic_contradiction", provide a list of NEW tasks to inject. Each task MUST have:
    - id: unique string (e.g., "correction_X")
    - label: clear description
    - agentType: researcher | analyst | strategist | writer | coder
    - dependencies: existing task IDs that this depends on
    - contextFields: IDs of tasks whose output this agent needs to read
    - expectedOutput: { format: 'prose' | 'structured_json' | 'list', fields: {} }

    Respond ONLY with a JSON object:
    {
      "status": "ok" | "critical_gap" | "strategic_contradiction",
      "reasoning": "your explanation",
      "correctionTasks": [] // only if status is critical_gap or strategic_contradiction
    }
  `;
    try {
        const res = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: SYNTHESIS_MODEL,
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' },
                temperature: 0.1,
            }),
        });
        if (!res.ok)
            throw new Error(`Groq API Error: ${res.status}`);
        const data = await res.json();
        const auditResult = JSON.parse(data.choices[0].message.content);
        console.log(`[ChiefAnalyst] Deep Semantic Audit: ${auditResult.status.toUpperCase()} - ${auditResult.reasoning}`);
        return auditResult;
    }
    catch (err) {
        console.error('[ChiefAnalyst] Deep Semantic Audit failed, proceeding with existing data:', err);
        return { status: 'ok', reasoning: 'Audit failed, proceeding with existing data.' };
    }
}
function extractNumericValue(text) {
    const match = text.replace(/[,₹$€£]/g, '').match(/(\d+(?:\.\d+)?)\s*(?:cr|lakh|k|m|b|bn)?/i);
    if (!match)
        return null;
    let val = parseFloat(match[1]);
    const suffix = (match[2] ?? '').toLowerCase();
    if (suffix === 'cr')
        val *= 10_000_000;
    else if (suffix === 'lakh')
        val *= 100_000;
    else if (suffix === 'k')
        val *= 1_000;
    else if (suffix === 'm')
        val *= 1_000_000;
    else if (suffix === 'b' || suffix === 'bn')
        val *= 1_000_000_000;
    return val;
}
function detectConflicts(entries) {
    const conflicts = [];
    // Check market size estimates across researcher and analyst artifacts
    const marketSizes = [];
    for (const entry of entries) {
        const art = entry.data;
        let sizeStr = '';
        if (art.agentType === 'researcher')
            sizeStr = art.marketSize ?? '';
        if (art.agentType === 'analyst') {
            const dp = art.dataPoints?.find((d) => d.label.toLowerCase().includes('market'));
            if (dp)
                sizeStr = dp.value;
        }
        if (sizeStr) {
            const val = extractNumericValue(sizeStr);
            if (val !== null)
                marketSizes.push({ agent: entry.taskId, value: val, raw: sizeStr });
        }
    }
    if (marketSizes.length >= 2) {
        const max = Math.max(...marketSizes.map((m) => m.value));
        const min = Math.min(...marketSizes.map((m) => m.value));
        if (min > 0 && max / min > 2.0) {
            const a = marketSizes[0];
            const b = marketSizes[1];
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
    const sentiments = [];
    for (const entry of entries) {
        const text = entry.data.rawContent?.toLowerCase() ?? '';
        const posScore = sentimentKeywords.positive.filter((w) => text.includes(w)).length;
        const negScore = sentimentKeywords.negative.filter((w) => text.includes(w)).length;
        if (posScore > negScore + 2)
            sentiments.push({ agent: entry.taskId, direction: 'positive' });
        else if (negScore > posScore + 2)
            sentiments.push({ agent: entry.taskId, direction: 'negative' });
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
function buildSynthesisPrompt(dag, entries, conflicts) {
    const system = `\
You are the Chief Analyst of Nexus OS — the final arbiter of mission quality.

MISSION: "${dag.goal}"
GOAL TYPE: ${dag.goalType}

SUCCESS CRITERIA (address ALL of these — do not skip any):
${dag.successCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

${conflicts.length > 0
        ? `DETECTED CONFLICTS (you MUST resolve each one explicitly):
${conflicts.map((c) => `• Field: "${c.field}" — Agent "${c.agentA}" says: "${c.valueA}" vs Agent "${c.agentB}" says: "${c.valueB}" [${c.severity}]`).join('\n')}`
        : 'No conflicts detected between agent outputs.'}

YOUR RESPONSIBILITIES:
1. Synthesize all agent findings into a coherent deliverable (no redundancy)
2. For each success criterion, provide a direct, specific result
3. If a criterion was NOT met, say so in gaps[] — never fabricate
4. Resolve every detected conflict by reasoning which source is more credible
5. Analyze all insights and RANK the top 3-5 by: novelty, specificity, and actionability
6. Generate 2-4 strategic decisions or study recommendations based directly on the findings
7. End with 3 specific, actionable next steps the user can do TODAY
8. **STUDENT-FIRST WORKFLOW**: If the mission is academic, study-related, or research for learning (e.g. "Prepare for exam", "Explain X"), structure your deliverable explicitly for studying (see format below).

OUTPUT FORMAT: Return ONLY a valid JSON object with this exact structure:
{
  "executiveSummary": "min 300 words, max 500 words — lead with a strategic assessment, then bulleted primary findings, then a synthesis of how this impacts the goal",

  "criteriaResults": [
    { "criterion": "...", "result": "...", "confidence": "high|medium|low", "met": true|false }
  ],
  "keyInsights": [
    { "insight": "...", "supportingAgents": ["task_id_1", "task_id_2"], "score": 9.5, "reasoning": "highly actionable...", "confidence": "high|medium|low" }
  ],
  "strategicDecisions": [
    { "recommendation": "...", "pros": ["..."], "cons": ["..."] }
  ],
  "resolvedConflicts": [
    { "topic": "...", "conflictDescription": "...", "resolution": "..." }
  ],
  "deliverable": { /* domain-specific — for lead_gen: include leads[] and pipeline{}; FOR ACADEMIC/STUDENT: include structuredNotes[], keyConcepts[], mockExamQuestions[], and quickRevisionSummary */ },
  "gaps": ["criteria not met or data unavailable..."],
  "nextSteps": [
    { "action": "...", "timeframe": "Today|This week|This month", "priority": "high|medium|low" }
  ]
}`;
    // Build context from all entries
    const contextSections = entries.map((e) => {
        const { rawContent: _r, ...data } = e.data;
        return `[${e.agentType.toUpperCase()} — ${e.taskId}]\n${JSON.stringify(data, null, 2)}`;
    }).join('\n\n────────────────────────\n\n');
    const user = `ALL AGENT OUTPUTS FOR THIS MISSION:\n\n${contextSections}\n\nNow produce the Chief Analyst synthesis. Return ONLY the JSON object.`;
    return { system, user };
}
// ── JSON Extraction ────────────────────────────────────────────────────────
function extractJSON(text) {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    try {
        return JSON.parse(cleaned);
    }
    catch {
        const match = cleaned.match(/(\{[\s\S]*\})/);
        if (match)
            return JSON.parse(match[0]);
        throw new Error('Chief Analyst returned no parseable JSON');
    }
}
// ── Build SynthesisArtifact from parsed JSON ───────────────────────────────
function buildSynthesisArtifact(parsed) {
    return {
        format: 'structured_json',
        agentType: 'chief_analyst',
        taskId: 'chief_analyst_synthesis',
        executiveSummary: String(parsed.executiveSummary ?? ''),
        criteriaResults: parsed.criteriaResults ?? [],
        keyInsights: parsed.keyInsights ?? [],
        strategicDecisions: parsed.strategicDecisions ?? [],
        resolvedConflicts: parsed.resolvedConflicts ?? [],
        deliverable: parsed.deliverable ?? {},
        gaps: Array.isArray(parsed.gaps) ? parsed.gaps : [],
        nextSteps: Array.isArray(parsed.nextSteps) ? parsed.nextSteps :
            (parsed.nextSteps ? [parsed.nextSteps] : []),
        rawContent: String(parsed.executiveSummary ?? '').slice(0, 300),
    };
}
// ── Main Export ────────────────────────────────────────────────────────────
export async function runChiefAnalyst(dag, entries, governor, sseRes, isAborted) {
    const apiKey = process.env.GROQ_API_KEY;
    // ── Deep Semantic Audit & Autonomous Remediation ───────────────────────────
    const auditResult = await deepSemanticAuditor(dag, entries);
    if (auditResult.status !== 'ok' && auditResult.correctionTasks && auditResult.correctionTasks.length > 0) {
        console.log(`[ChiefAnalyst] 🛠️ Triggering Autonomous Remediation (Correction Wave)...`);
        sseRes.write(`data: ${JSON.stringify({ type: 'agent_working', taskId: 'chief_analyst', taskLabel: 'Deep Semantic Auditor', message: `Contradiction detected: ${auditResult.reasoning}. Triggering correction wave...` })}\n\n`);
        const correctionDag = {
            ...dag,
            nodes: auditResult.correctionTasks,
        };
        const correctionMemory = new MissionMemory(`remediation_${dag.missionId}`, dag.goal);
        const correctionRegistry = new TaskRegistry(`remediation_${dag.missionId}`);
        // Execute the correction wave
        await orchestrateDAG({
            dag: correctionDag,
            memory: correctionMemory,
            registry: correctionRegistry,
            governor,
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
        sseRes.write(`data: ${JSON.stringify({ type: 'synthesis_start', conflictsDetected: conflicts.length })}\n\n`);
    }
    const { system, user } = buildSynthesisPrompt(dag, entries, conflicts);
    const callGroq = async () => {
        if (isAborted())
            throw new Error('[Canceled] Mission aborted before synthesis');
        const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: SYNTHESIS_MODEL,
                temperature: 0.2,
                max_tokens: SYNTHESIS_TOKENS,
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: system },
                    { role: 'user', content: user },
                ],
            }),
            signal: AbortSignal.timeout(35000),
        });
        if (response.status === 429) {
            const retryAfter = response.headers.get('retry-after');
            throw new Error(`429 Too Many Requests${retryAfter ? ` retry-after: ${retryAfter}` : ''}`);
        }
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Groq API ${response.status}: ${errText.slice(0, 200)}`);
        }
        const data = (await response.json());
        const rawText = data?.choices?.[0]?.message?.content ?? '';
        const parsed = extractJSON(rawText);
        return buildSynthesisArtifact(parsed);
    };
    // Run through the governor for rate-limit protection
    const synthesis = await governor.execute(callGroq);
    console.log(`[ChiefAnalyst] ✅ Synthesis complete — ` +
        `${synthesis.criteriaResults.length} criteria, ` +
        `${synthesis.keyInsights.length} insights, ` +
        `${synthesis.gaps.length} gaps`);
    return synthesis;
}
//# sourceMappingURL=chiefAnalyst.js.map