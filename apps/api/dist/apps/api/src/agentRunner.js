/**
 * Nexus OS — Agent Runner v2
 *
 * Replaces the runAgent() function in agentManager.ts.
 * Key changes:
 *
 * 1. buildAgentPrompt() — 4-part prompt: role+goal, context (selective),
 *    output schema enforcement, anti-hallucination constraints.
 *
 * 2. parseTypedArtifact() — attempts to parse LLM output as a TypedArtifact.
 *    Falls back gracefully: if JSON parse fails, wraps prose in a ContentArtifact.
 *    Never returns raw undefined or throws on bad output.
 *
 * 3. Token budget management — different limits per agent type.
 *    Researcher gets more tokens; summarizer gets fewer.
 */
import { semanticBridge } from './SemanticBridge.js';
// ── AI Config ──────────────────────────────────────────────────────────────
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_FAST_MODEL = 'llama-3.1-8b-instant';
const GROQ_POWER_MODEL = 'llama-3.3-70b-versatile';
const TOKEN_BUDGET = {
    researcher: 1400, // Doubled for depth
    analyst: 1400, // Doubled for depth
    strategist: 1200, // Increased
    writer: 1000,
    coder: 1000,
    summarizer: 600,
    chief_analyst: 1800, // Increased for massive synthesis
};
// ── Agent Role Descriptions ────────────────────────────────────────────────
const AGENT_ROLES = {
    researcher: 'Research Specialist. Your job: find facts, identify patterns, and surface relevant data. ' +
        'Be specific and concrete. Cite the type of source for each finding (e.g., "industry report," "news article," "market data").',
    analyst: 'Data & Business Analyst. Your job: interpret data, apply frameworks (SWOT, Porter\'s Five Forces, etc.), ' +
        'and produce structured analysis with clear recommendations. Quantify wherever possible.',
    writer: 'Senior Content Strategist. Your job: produce polished, publication-ready prose. ' +
        'Clear narrative structure, compelling opening, concrete specifics. Adapt tone to the business context.',
    coder: 'Principal Software Engineer. Your job: produce clean, typed, production-ready code. ' +
        'Include architecture rationale, use best practices. Comment non-obvious sections.',
    strategist: 'McKinsey-level Management Strategist. Your job: produce actionable strategic recommendations. ' +
        'Use structured frameworks. Separate quick wins (this week) from long-term roadmap items.',
    summarizer: 'Executive Synthesizer. Your job: distill all agent outputs into a crisp, board-level summary. ' +
        'Lead with the single most important insight. Follow with key takeaways. End with a clear next step.',
    chief_analyst: 'Chief Analyst & Mission Director. Your job: integrate all agent outputs, resolve conflicts, ' +
        'validate against success criteria, and produce the final business-ready deliverable.',
};
// ── Output Schema Instructions ─────────────────────────────────────────────
// ── Lead Schema (strict enforcement for lead_gen tasks) ────────────────────
function buildLeadSchema(minItems) {
    return `
OUTPUT FORMAT: Return ONLY a valid JSON object with a "leads" array. No markdown fences.
Required structure:
{
  "leads": [
    {
      "name": "Full realistic name appropriate for the target market (NOT John Doe or placeholder)",
      "company": "Real or realistic company name (NOT Acme Corp or Example Ltd)",
      "role": "Specific job title (e.g., Sales Director, Operations Head, Co-founder)",
      "location": "Specific city and neighborhood if known (e.g., Dwarka, New Delhi)",
      "niche": "Specific market segment (e.g., NRI investment properties, commercial leasing)",
      "painPoint": "Concrete business problem they face — minimum 15 words, specific to their market",
      "outreachHook": "One sentence connecting their pain to a solution you offer",
      "linkedInSearch": "Search string: '\"[role]\" \"[niche]\" site:linkedin.com'",
      "dataSource": "estimated"
    }
  ],
  "rawContent": "Brief summary: X leads generated in [niche] targeting [location]"
}
Generate EXACTLY ${minItems} leads minimum.
Every lead must be unique — different names, roles, and specific pain points.
dataSource MUST always be "estimated" — never claim these are real contacts.
DO NOT use: John Doe, Jane Doe, Acme, Example, Test, Placeholder, [brackets], or generic English names for Indian markets.`;
}
function buildOutputInstruction(task, goalType) {
    // Lead generation override — most critical quality fix
    if (goalType === 'lead_gen' &&
        task.agentType === 'researcher' &&
        task.expectedOutput.format === 'list') {
        return buildLeadSchema(task.expectedOutput.minItems ?? 10);
    }
    // Outreach messages override
    if (goalType === 'lead_gen' &&
        task.agentType === 'writer' &&
        task.expectedOutput.format === 'list') {
        return `
OUTPUT FORMAT: Return ONLY a valid JSON object with a "messages" array. No markdown fences.
Required structure:
{
  "messages": [
    {
      "leadName": "Name of the lead this message targets",
      "channel": "email | linkedin | whatsapp",
      "subject": "Specific, personalized subject line referencing their context",
      "body": "3-5 sentence message: opening hook about THEIR pain, your solution, specific CTA",
      "callToAction": "One clear next step (e.g., '15-min call Thursday?')"
    }
  ],
  "rawContent": "X outreach messages generated for [campaign]"
}
Generate one message per lead from the lead list. No generic copy-paste messages.
Each message body must reference the specific painPoint of that lead.`;
    }
    const schema = task.expectedOutput;
    if (schema.format === 'structured_json') {
        const fields = schema.fields
            ? Object.entries(schema.fields)
                .map(([k, v]) => `  "${k}": ${v}`)
                .join(',\n')
            : '  // fields defined by your task';
        return `
OUTPUT FORMAT: Respond ONLY with a valid JSON object. No markdown fences. No explanation before or after.
Required JSON structure:
{
${fields}
}
${schema.example ? `Example value for reference: ${schema.example}` : ''}
Include a "rawContent" field with a 1-2 sentence human-readable summary of your findings.`;
    }
    if (schema.format === 'list') {
        return `
OUTPUT FORMAT: Respond ONLY with a valid JSON object containing a single array field.
The array must contain at least ${schema.minItems ?? 5} items.
Each item must be a complete object with all relevant fields (not a string).
${schema.example ? `Example item: ${schema.example}` : ''}
Include a "rawContent" field: brief summary of the list at the top level.
Do NOT return a plain JSON array — wrap it in an object.`;
    }
    if (schema.format === 'code') {
        return `
OUTPUT FORMAT: Respond ONLY with a valid JSON object:
{
  "language": "the programming language used",
  "code": "the complete code as a single string (use \\n for newlines)",
  "explanation": "2-3 sentences explaining the architecture/approach",
  "rawContent": "same as explanation"
}`;
    }
    // prose
    return `
OUTPUT FORMAT: Prose. Write 200-500 words of specific, concrete analysis.
No generic filler sentences. Every sentence must directly address the task.
Do NOT describe your methodology — produce the actual output.
Do NOT return JSON for prose tasks.`;
}
// ── Anti-Hallucination Constraints ────────────────────────────────────────
const CONSTRAINTS = `
CRITICAL CONSTRAINTS (ANTI-FILLER PROTOCOL 2.0):
- Never use placeholders like "John Doe", "Jane Doe", "Acme Corp", "Example Ltd", "[Company Name]", "[Role]", "Test Person", or any bracketed text
- FORBIDDEN: "This is important", "It is crucial", "A variety of factors", "Moving forward", "Strategic considerations"
- RULE: For every 1 generic claim, you must provide 3 concrete data points, specific entity names, or hard numbers (Real or highly plausible)
- Never invent statistics you are not confident about — prefix estimates with "ESTIMATE:" and explain your basis
- Do not use "lorem ipsum", "TODO", "[insert X here]", or any template filler text
- Do not describe your methodology or process — produce the actual deliverable directly
- For lead generation: use realistic names, real localities, and real industry sectors from the target market
- For Indian markets: use real city names (Delhi, Mumbai, Gurugram, Noida, Bangalore) and real industries
- Every name, company, and role you generate must be PLAUSIBLE for the target market — not generic English placeholders
- This output goes directly to a business user who will act on it — specificity and plausibility are mandatory
- dataSource must always be "estimated" — never claim AI-generated leads are from a real database`;
// ── Prompt Builder ─────────────────────────────────────────────────────────
export function buildAgentPrompt(task, goal, goalType, context) {
    // PART 1: Role + Mission Awareness
    const roleBlock = `You are a ${AGENT_ROLES[task.agentType]}\n\n` +
        `MISSION GOAL: "${goal}"\n` +
        `GOAL TYPE: ${goalType}\n` +
        `YOUR TASK: ${task.label}\n` +
        `TASK PRIORITY: ${task.priority}` +
        (task.priority === 'critical'
            ? ' — This is a critical deliverable. Do not skip or summarize.'
            : '');
    // PART 2: Output schema enforcement (goal-type-aware)
    const outputInstruction = buildOutputInstruction(task, goalType);
    // PART 3: Anti-hallucination
    const system = roleBlock + '\n' + outputInstruction + '\n' + CONSTRAINTS;
    // PART 4: Context (selective, structured — from MissionMemory.selectiveRead)
    const user = (context.promptBlock || '') +
        `\n\nNow produce your output for this task: "${task.label}"\n` +
        `Respond immediately with your output. No preamble.`;
    return { system, user };
}
// ── Output Parser ──────────────────────────────────────────────────────────
/**
 * Attempts to parse LLM response into a TypedArtifact.
 * Never throws — always returns a valid artifact.
 *
 * Priority:
 * 1. Try JSON.parse → wrap in the right artifact type
 * 2. Try extracting JSON block from mixed text
 * 3. Wrap raw text in ContentArtifact (graceful degradation)
 */
export function parseTypedArtifact(rawText, task) {
    const format = task.expectedOutput.format;
    // Try to parse JSON if expected
    if (format === 'structured_json' || format === 'list') {
        const parsed = tryParseJSON(rawText);
        if (parsed) {
            return buildTypedArtifact(parsed, task);
        }
        // JSON parse failed — log and degrade
        console.warn(`[AgentRunner] ⚠️ JSON parse failed for ${task.id}, wrapping as prose`);
    }
    if (format === 'code') {
        const parsed = tryParseJSON(rawText);
        if (parsed && parsed.code) {
            return {
                format: 'code',
                agentType: task.agentType,
                taskId: task.id,
                language: parsed.language ?? 'unknown',
                code: parsed.code,
                explanation: parsed.explanation ?? '',
                rawContent: rawText.slice(0, 300),
            };
        }
    }
    // Graceful degradation: wrap as ContentArtifact
    return {
        format: 'prose',
        agentType: task.agentType,
        taskId: task.id,
        body: rawText,
        wordCount: rawText.split(/\s+/).length,
        rawContent: rawText,
    };
}
function tryParseJSON(text) {
    // Strip code fences
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    try {
        const parsed = JSON.parse(cleaned);
        if (typeof parsed === 'object' && parsed !== null)
            return parsed;
    }
    catch {
        // Try extracting the first {...} block
        const match = cleaned.match(/(\{[\s\S]*\})/);
        if (match) {
            try {
                const parsed = JSON.parse(match[0]);
                if (typeof parsed === 'object' && parsed !== null)
                    return parsed;
            }
            catch {
                // fall through
            }
        }
    }
    return null;
}
function buildTypedArtifact(parsed, task) {
    const agentType = task.agentType;
    const taskId = task.id;
    switch (agentType) {
        case 'researcher': {
            // Check if it's a lead list (researcher can produce both)
            if (parsed.leads || parsed.lead_list) {
                const rawLeads = (parsed.leads ?? parsed.lead_list ?? []);
                const sanitized = rawLeads.map(sanitizeLead);
                const { valid, rejectedCount } = validateLeadList(sanitized);
                const finalLeads = valid.length > 0 ? valid : sanitized; // fallback: use all if all rejected
                return {
                    format: 'list',
                    agentType: 'researcher',
                    taskId,
                    leads: finalLeads,
                    rawContent: `${finalLeads.length} leads generated (${rejectedCount} placeholder leads rejected)`,
                };
            }
            return {
                format: 'structured_json',
                agentType: 'researcher',
                taskId,
                niche: String(parsed.niche ?? ''),
                location: String(parsed.location ?? ''),
                findings: Array.isArray(parsed.findings) ? parsed.findings : [],
                keyEntities: Array.isArray(parsed.keyEntities) ? parsed.keyEntities : [],
                marketSize: String(parsed.marketSize ?? parsed.market_size ?? ''),
                targetProfile: String(parsed.targetProfile ?? parsed.target_profile ?? ''),
                painPoints: Array.isArray(parsed.painPoints) ? parsed.painPoints : [],
                rawContent: String(parsed.rawContent ?? ''),
            };
        }
        case 'analyst':
            return {
                format: 'structured_json',
                agentType: 'analyst',
                taskId,
                swot: parsed.swot ?? undefined,
                recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
                dataPoints: Array.isArray(parsed.dataPoints) ? parsed.dataPoints : [],
                recommendedNiche: String(parsed.recommendedNiche ?? parsed.recommended_niche ?? ''),
                riskLevel: parsed.riskLevel ?? 'medium',
                rawContent: String(parsed.rawContent ?? ''),
            };
        case 'strategist':
            return {
                format: 'structured_json',
                agentType: 'strategist',
                taskId,
                executiveSummary: String(parsed.executiveSummary ?? parsed.executive_summary ?? ''),
                roadmap: Array.isArray(parsed.roadmap) ? parsed.roadmap : [],
                risks: Array.isArray(parsed.risks) ? parsed.risks : [],
                quickWins: Array.isArray(parsed.quickWins) ? parsed.quickWins : [],
                rawContent: String(parsed.rawContent ?? ''),
            };
        case 'writer':
        case 'summarizer': {
            const body = String(parsed.body ?? parsed.content ?? parsed.text ?? JSON.stringify(parsed));
            return {
                format: 'prose',
                agentType,
                taskId,
                title: String(parsed.title ?? ''),
                body,
                wordCount: body.split(/\s+/).length,
                rawContent: body,
            };
        }
        default: {
            // Generic fallback
            const body = JSON.stringify(parsed, null, 2);
            return {
                format: 'prose',
                agentType: agentType, // Type assertion for compat
                taskId,
                body,
                wordCount: body.split(/\s+/).length,
                rawContent: body,
            };
        }
    }
}
// ── Lead Validation ──────────────────────────────────────────────────────────
const LEAD_PLACEHOLDER_PATTERNS = [
    /\bjohn\s+doe\b/i, /\bjane\s+doe\b/i, /\bacme\b/i, /\bexample\b/i,
    /\btest\s+user\b/i, /\blorem\b/i, /\bplaceholder\b/i, /\btodo\b/i,
    /\byour\s+name\b/i, /\bcompany\s+name\b/i, /\bxyz\s+corp\b/i,
    /\[.*?\]/, // anything in [square brackets]
];
function isPlaceholderLead(lead) {
    const text = `${lead.name ?? ''} ${lead.company ?? ''} ${lead.role ?? ''}`;
    return LEAD_PLACEHOLDER_PATTERNS.some(p => p.test(text)) ||
        !lead.painPoint || lead.painPoint.length < 15;
}
function validateLeadList(leads) {
    const valid = [];
    let rejectedCount = 0;
    for (const lead of leads) {
        if (isPlaceholderLead(lead)) {
            console.warn(`[AgentRunner] 🚫 Rejected placeholder lead: "${lead.name}" at "${lead.company}"`);
            rejectedCount++;
        }
        else {
            valid.push(lead);
        }
    }
    if (rejectedCount > 0) {
        console.warn(`[AgentRunner] Lead validation: ${valid.length} valid, ${rejectedCount} rejected`);
    }
    return { valid, rejectedCount };
}
function sanitizeLead(raw) {
    return {
        name: raw.name ?? '[Not identified]',
        company: raw.company ?? raw.organization ?? '[Company unknown]',
        role: raw.role ?? raw.title ?? raw.position ?? '[Role unknown]',
        location: raw.location ?? raw.city ?? '',
        niche: raw.niche ?? raw.sector ?? '',
        painPoint: raw.painPoint ?? raw.pain_point ?? raw.challenge ?? '',
        outreachHook: raw.outreachHook ?? raw.outreach_hook ?? raw.hook ?? '',
        linkedInSearch: raw.linkedInSearch ?? raw.linkedin_search ?? `"${raw.role}" "${raw.niche}"`,
        dataSource: 'estimated', // always estimated — never claim real data
    };
}
async function runGroq(opts) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey)
        throw new Error('GROQ_API_KEY not set');
    const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: opts.model,
            temperature: opts.temperature,
            max_tokens: opts.maxTokens,
            messages: [
                { role: 'system', content: opts.system },
                { role: 'user', content: opts.user },
            ],
        }),
        signal: AbortSignal.timeout(25000),
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
    return {
        content: data?.choices?.[0]?.message?.content ?? '[No output]',
        tokens: (data?.usage?.completion_tokens ?? 0) + (data?.usage?.prompt_tokens ?? 0),
    };
}
export async function runAgent(opts) {
    const { task, goal, goalType, context, sseRes, isAborted } = opts;
    // ── Step 1: Semantic Context Compression (Information Density) ─────────────
    // Instead of raw context, we use the SemanticBridge to digest it.
    const briefing = context.entries.length > 0
        ? await semanticBridge.synthesizeBriefing(goal, context.entries, task)
        : 'No prior context available. Start from scratch.';
    // Update context with the synthesized briefing
    const synthesizedContext = {
        ...context,
        promptBlock: `### MISSION BRIEFING (Synthesized Truths)\n${briefing}\n\n`
    };
    const { system, user } = buildAgentPrompt(task, goal, goalType, synthesizedContext);
    const maxTokens = TOKEN_BUDGET[task.agentType] ?? 600;
    if (isAborted())
        throw new Error('[Canceled] Mission aborted');
    // ── Step 2: Quality Routing ─────────────────────────────────────────────
    const isIntelligenceTask = task.agentType === 'researcher' ||
        task.agentType === 'analyst' ||
        task.agentType === 'chief_analyst';
    // ── Step 3: Council of Three (Logical Cross-Examination) ─────────────────
    // For critical tasks, we run two specialists and then a reasoning judge.
    if (task.priority === 'critical' && task.agentType !== 'chief_analyst') {
        console.log(`[AgentRunner] ⚖️  Council of Three activated for Critical Task: ${task.id}`);
        // 1. Run two independent specialists in parallel (Fast Model)
        const [specialist1, specialist2] = await Promise.all([
            runGroq({ system, user, model: GROQ_FAST_MODEL, maxTokens, temperature: 0.4 }),
            runGroq({ system, user, model: GROQ_FAST_MODEL, maxTokens, temperature: 0.7 }),
        ]);
        // 2. Reasoning Judge resolves conflicts (Power Model)
        const judgePrompt = `
      You are the NexusOS Reasoning Judge.
      MISSION GOAL: "${goal}"
      TARGET TASK: "${task.label}"

      AGENT OUTPUT 1:
      ${specialist1.content}

      AGENT OUTPUT 2:
      ${specialist2.content}

      REASONING TASK:
      1. Identify contradictions or factual errors between the two outputs.
      2. Resolve any logical inconsistencies based on the MISSION GOAL.
      3. Synthesize a single, "Verified Artifact" that combines the best parts of both.
      4. Ensure the output strictly follows the required format for Task: ${task.label}.

      Respond ONLY with the final, verified content. No judge commentary.
    `;
        const { content: verifiedContent, tokens: judgeTokens } = await runGroq({
            system: "You are a master logic judge. Resolve conflicts and synthesize truth.",
            user: judgePrompt,
            model: GROQ_POWER_MODEL,
            maxTokens,
            temperature: 0.1,
        });
        const artifact = parseTypedArtifact(verifiedContent, task);
        const totalTokens = specialist1.tokens + specialist2.tokens + judgeTokens;
        return { artifact, tokensUsed: totalTokens, rawContent: verifiedContent };
    }
    // Standard execution flow
    const usePowerModel = isIntelligenceTask || task.priority === 'critical';
    const model = usePowerModel ? GROQ_POWER_MODEL : GROQ_FAST_MODEL;
    const { content, tokens } = await runGroq({
        system,
        user,
        model,
        maxTokens,
        temperature: task.agentType === 'analyst' ? 0.3 : 0.6,
    });
    const artifact = parseTypedArtifact(content, task);
    return { artifact, tokensUsed: tokens, rawContent: content };
}
//# sourceMappingURL=agentRunner.js.map