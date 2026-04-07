/**
 * Nexus OS — Mission Planner v2.1
 *
 * High-precision task decomposition engine designed to prevent generic
 * "copy-paste" outputs through dynamic domain guidance and strict anti-filler rules.
 */
import { findBestAgentForType } from './agents/agentRegistry.js';
// ── Constants ──────────────────────────────────────────────────────────────
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const PLANNER_MODEL = 'llama-3.3-70b-versatile';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const SIMILARITY_THRESHOLD = 0.55; // n-gram overlap for duplicate detection
const VALID_AGENT_TYPES = [
    'researcher', 'analyst', 'writer', 'coder', 'strategist', 'summarizer',
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// ── Domain-Specific Guidance ────────────────────────────────────────────────
/**
 * Replaces old rigid templates to encourage unique, goal-aware planning.
 */
function getDomainGuidance(goalType) {
    const guidance = {
        lead_gen: `
FOCUS: Qualified lead discovery and outreach strategy.
- Task 1: Niche & Persona Discovery (Research)
- Task 2: High-Intent Lead Scraping (Research — min 10 unique profiles)
- Task 3: Lead Validation & Scoring (Analysis)
- Task 4: Contextual Outreach Copy (Writer)
`,
        strategy: `
FOCUS: Actionable roadmaps and competitive positioning.
- Task 1: Market Landscape & Competitor Mapping (Research)
- Task 2: SWOT / Gap Analysis (Analysis)
- Task 3: Strategic Roadmap with KPIs & Quick Wins (Strategist)
`,
        research: `
FOCUS: Fact-finding and data synthesis.
- Task 1: Primary Data Search (Research)
- Task 2: Cross-Validation & Conflict Detection (Analyst)
- Task 3: Trend Analysis & Future Outlook (Analyst)
`,
        code: `
FOCUS: Functional, typed, and tested implementation.
- Task 1: Technical Spec & Architecture (Researcher/Coder)
- Task 2: Core Module Implementation (Coder — code format)
- Task 3: Unit Testing & Performance Audit (Coder — code format)
`,
    };
    return guidance[goalType] || "Decompose the goal into specific, non-generic sub-tasks suitable for specialized agents.";
}
// ── System Prompt ──────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `\
You are the Nexus Master Brain (NMB) — the high-level orchestration engine of the OS.
Your ONLY job: analyze a user goal, break it down into the absolute MINIMUM required tasks, and dynamically recruit the necessary agents.

RECRUITMENT POLICY (CRITICAL):
1. **Dynamic Selection**: Only call agents that are strictly necessary for the "Success Criteria." 
2. **Pruning**: If a mission is simple (e.g., just research), DO NOT hire an Analyst or Strategist. Noise is a failure.
3. **Accountability**: Every task you create MUST be directly linked to a specific success criterion. 

OUTPUT SCHEMA:
{
  "goalType": string,          // one of: lead_gen | research | content | strategy | analysis | code | general
  "successCriteria": string[], // 3-5 specific, measurable outcomes that define mission success
  "nodes": TaskNode[]
}


TaskNode:
{
  "id": string,                // unique snake_case, MUST incorporate goal-specific keywords
  "label": string,             // action-oriented, max 65 chars. MUST BE DOMAIN SPECIFIC.
  "agentType": string,         // researcher | analyst | writer | coder | strategist | summarizer
  "dependencies": string[],    // IDs of tasks that MUST complete first. [] = runs in wave 1
  "priority": string,          // critical | high | medium | low
  "maxRetries": number,        // 1-3 depending on criticality
  "expectedOutput": {
    "format": string,          // structured_json | prose | list | code
    "fields": {},              // required if format=structured_json: {fieldName: "description"}
    "minItems": number,        // required if format=list
    "example": string          // one-line example of a single output item or key field
  },
  "contextFields": string[]    // IDs of tasks whose outputs this task should read (subset of dependencies)
}

ANTI-REPETITION & DEPTH RULES (MASTER BRAIN PROTOCOL):
1. NO GENERIC LABELS. Use "[Action] [Specific Niche] in [Specific Location]".
2. FORBIDDEN WORDS: general, basic, standard, industry-standard, placeholder, example, generic, overview.
3. SPECIFICITY: Every task label and ID must contain 2-3 keywords directly from the user's mission goal.
4. VARIATION: Ensure tasks represent separate, non-overlapping angles of the problem.
5. QUALITY OVER QUANTITY: 3 high-depth tasks are better than 8 shallow ones.

ORCHESTRATION RULES:
1. Tasks with dependencies=[] run in parallel (Wave 1). These MUST be truly independent.
2. Tasks that depend on Wave 1 outputs run in Wave 2, etc.
3. NEVER create cycles. If task B depends on A, A cannot depend on B.
4. The LAST node must synthesize all others. Set its dependencies to ALL other task IDs.
   Use agentType="summarizer" (the Chief Analyst will upgrade it automatically).
5. For lead_gen goals: researcher must output structured_json with fields:
   {niche, location, targetProfile, painPoints, findings}
   A separate researcher or analyst task must produce leads with format=list and minItems=10.
6. For strategy goals: strategist must output structured_json with fields:
   {executiveSummary, roadmap, risks, quickWins}
7. For content goals: writer must output prose.
8. Align tasks directly to the goal — no generic filler tasks.
9. Set priority="critical" only for tasks directly required for success criteria.
10. contextFields must be a SUBSET of dependencies (can't read from tasks you don't depend on).
11. Do NOT exceed 8 nodes total. Quality over quantity.
`;
// ── Helpers (De-duping, Cycle detection, etc) ────────────────────────────────
function ngramSimilarity(a, b, n = 3) {
    const ngrams = (s) => {
        const set = new Set();
        const lower = s.toLowerCase().replace(/[^a-z0-9\s]/g, '');
        for (let i = 0; i < lower.length - n + 1; i++) {
            set.add(lower.slice(i, i + n));
        }
        return set;
    };
    const setA = ngrams(a);
    const setB = ngrams(b);
    if (setA.size === 0 && setB.size === 0)
        return 1;
    const intersection = [...setA].filter((x) => setB.has(x)).length;
    const union = new Set([...setA, ...setB]).size;
    return union === 0 ? 0 : intersection / union;
}
function deduplicateAndScore(nodes, goal) {
    const unique = [];
    for (const candidate of nodes) {
        // Check against already-accepted tasks for near-duplicates
        const isDuplicate = unique.some((existing) => ngramSimilarity(candidate.label, existing.label) > SIMILARITY_THRESHOLD);
        if (isDuplicate) {
            console.log(`[Planner] ✂️ Dropped duplicate task: "${candidate.label}"`);
            continue;
        }
        // Score how directly this task serves the goal
        candidate.goalAlignment = ngramSimilarity(candidate.label, goal);
        // Drop low-alignment low-priority noise tasks
        if (candidate.goalAlignment < 0.07 && candidate.priority === 'low') {
            console.log(`[Planner] ✂️ Dropped misaligned task: "${candidate.label}" ` +
                `(alignment: ${candidate.goalAlignment.toFixed(2)})`);
            continue;
        }
        unique.push(candidate);
    }
    // Sort: critical first, then by goalAlignment descending
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return unique.sort((a, b) => {
        const po = (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3);
        if (po !== 0)
            return po;
        return (b.goalAlignment ?? 0) - (a.goalAlignment ?? 0);
    });
}
function detectCycles(nodes) {
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const visited = new Set();
    const inStack = new Set();
    function dfs(id) {
        if (inStack.has(id))
            return true;
        if (visited.has(id))
            return false;
        inStack.add(id);
        const node = nodeMap.get(id);
        if (node) {
            for (const dep of node.dependencies) {
                if (dfs(dep))
                    return true;
            }
        }
        inStack.delete(id);
        visited.add(id);
        return false;
    }
    for (const node of nodes) {
        if (dfs(node.id))
            return node.id;
    }
    return null;
}
function validateAndRepair(raw, goal) {
    const plan = raw;
    if (!plan || typeof plan !== 'object')
        throw new Error('Plan is not an object');
    if (!Array.isArray(plan.nodes) || plan.nodes.length === 0) {
        throw new Error('Plan must have at least one node');
    }
    const ids = new Set(plan.nodes.map((n) => n.id));
    for (const node of plan.nodes) {
        if (!node.id)
            node.id = `task_${Math.random().toString(36).slice(2, 7)}`;
        if (!VALID_AGENT_TYPES.includes(node.agentType))
            node.agentType = 'researcher';
        if (!Array.isArray(node.dependencies))
            node.dependencies = [];
        if (!Array.isArray(node.contextFields))
            node.contextFields = node.dependencies.slice();
        if (!node.priority)
            node.priority = 'medium';
        if (typeof node.maxRetries !== 'number')
            node.maxRetries = 2;
        // Recruit specialized agent
        const specializedAgent = findBestAgentForType(node.agentType);
        node.agentId = specializedAgent.id;
        node.dependencies = node.dependencies.filter((dep) => ids.has(dep));
        // contextFields must be subset of dependencies
        node.contextFields = node.contextFields.filter((f) => node.dependencies.includes(f) && ids.has(f));
    }
    // Cycle check
    const cyclicNode = detectCycles(plan.nodes);
    if (cyclicNode) {
        throw new Error(`DAG cycle detected at node "${cyclicNode}"`);
    }
    // Compute waves
    let estimatedWaves = 0;
    const completed = new Set();
    let remaining = [...plan.nodes];
    while (remaining.length > 0) {
        const wave = remaining.filter((n) => n.dependencies.every((d) => completed.has(d)));
        if (wave.length === 0)
            break;
        wave.forEach((n) => completed.add(n.id));
        remaining = remaining.filter((n) => !completed.has(n.id));
        estimatedWaves++;
    }
    return {
        missionId: crypto.randomUUID(),
        goal,
        goalType: plan.goalType || 'general',
        successCriteria: Array.isArray(plan.successCriteria) ? plan.successCriteria : [],
        nodes: deduplicateAndScore(plan.nodes, goal),
        estimatedWaves,
    };
}
function extractJSON(raw) {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    try {
        return JSON.parse(cleaned);
    }
    catch {
        const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
        if (!match)
            throw new Error('No JSON block found');
        return JSON.parse(match[0]);
    }
}
function buildFallbackPlan(goal) {
    const missionId = crypto.randomUUID();
    return {
        missionId,
        goal,
        goalType: 'general',
        successCriteria: ['Complete basic mission objectives'],
        nodes: [
            { id: 'res_01', label: 'Initial Research', agentType: 'researcher', dependencies: [], expectedOutput: { format: 'prose' }, contextFields: [], priority: 'high', maxRetries: 2, goalAlignment: 1.0 },
            { id: 'sum_01', label: 'Final Summary', agentType: 'summarizer', dependencies: ['res_01'], expectedOutput: { format: 'prose' }, contextFields: ['res_01'], priority: 'critical', maxRetries: 1, goalAlignment: 1.0 }
        ],
        estimatedWaves: 2,
    };
}
// ── Main Export ────────────────────────────────────────────────────────────
export async function planMission(goal) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey)
        throw new Error('GROQ_API_KEY not set');
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            // 1. Detect Goal Type
            const dtResponse = await fetch(GROQ_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
                body: JSON.stringify({
                    model: PLANNER_MODEL,
                    temperature: 0.0,
                    max_tokens: 30,
                    messages: [
                        { role: 'system', content: 'Classify this goal into: lead_gen, strategy, research, content, code, analysis, general. Respond with only the label.' },
                        { role: 'user', content: goal },
                    ],
                }),
            });
            let goalType = 'general';
            if (dtResponse.ok) {
                const dtData = await dtResponse.json();
                goalType = dtData?.choices?.[0]?.message?.content?.trim().toLowerCase() || 'general';
            }
            // 2. Generate DAG
            const response = await fetch(GROQ_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
                body: JSON.stringify({
                    model: PLANNER_MODEL,
                    temperature: 0.15,
                    max_tokens: 1800,
                    messages: [
                        { role: 'system', content: SYSTEM_PROMPT },
                        { role: 'user', content: `GOAL: "${goal}"\nTYPE: ${goalType}\nGUIDANCE: ${getDomainGuidance(goalType)}\n\nReturn highly specific JSON.` },
                    ],
                    response_format: { type: 'json_object' },
                }),
            });
            if (!response.ok)
                throw new Error(`API Error: ${response.status}`);
            const data = await response.json();
            const raw = data?.choices?.[0]?.message?.content || '';
            const parsed = extractJSON(raw);
            return validateAndRepair(parsed, goal);
        }
        catch (err) {
            console.warn(`[Planner] Attempt ${attempt} failed: ${err}`);
            if (attempt < MAX_RETRIES)
                await sleep(RETRY_DELAY * attempt);
        }
    }
    return buildFallbackPlan(goal);
}
//# sourceMappingURL=missionPlanner.js.map