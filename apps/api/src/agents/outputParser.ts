import { 
  TaskNode, 
  TypedArtifact, 
  CodeArtifact, 
  ContentArtifact, 
  LeadListArtifact, 
  ResearchArtifact, 
  AnalysisArtifact, 
  StrategyArtifact 
} from '../../../packages/types/index.js';

/**
 * Attempts to parse LLM response into a TypedArtifact.
 */
export function parseTypedArtifact(
  rawText: string,
  task: TaskNode
): TypedArtifact {
  const format = task.expectedOutput.format;

  // Try to parse JSON if expected
  if (format === 'structured_json' || format === 'list') {
    const parsed = tryParseJSON(rawText);
    if (parsed) {
      return buildTypedArtifact(parsed, task);
    }
  }

  if (format === 'code') {
    const parsed = tryParseJSON(rawText);
    if (parsed && parsed.code) {
      return {
        format: 'code',
        agentType: task.agentType as 'coder',
        taskId: task.id,
        language: parsed.language ?? 'unknown',
        code: parsed.code,
        explanation: parsed.explanation ?? '',
        rawContent: rawText.slice(0, 300),
      } as CodeArtifact;
    }
  }

  // Graceful degradation: wrap as ContentArtifact
  return {
    format: 'prose',
    agentType: task.agentType as 'writer',
    taskId: task.id,
    body: rawText,
    wordCount: rawText.split(/\s+/).length,
    rawContent: rawText,
  } as ContentArtifact;
}

function tryParseJSON(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const candidates = [cleaned];
  const balancedObject = extractBalancedJSONObject(cleaned);

  if (balancedObject && balancedObject !== cleaned) {
    candidates.push(balancedObject);
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (typeof parsed === 'object' && parsed !== null) return parsed;
    } catch {
      // Try next candidate.
    }
  }

  return null;
}

function extractBalancedJSONObject(text: string): string | null {
  let start = -1;
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === '\\') {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === '{') {
      if (start === -1) start = i;
      depth++;
      continue;
    }
    if (char === '}') {
      if (depth === 0) continue;
      depth--;
      if (depth === 0 && start !== -1) {
        return text.slice(start, i + 1);
      }
    }
  }
  return null;
}

function buildTypedArtifact(parsed: Record<string, unknown>, task: TaskNode): TypedArtifact {
  const agentType = task.agentType;
  const taskId = task.id;

  switch (agentType) {
    case 'researcher': {
      if (parsed.leads || parsed.lead_list) {
        const rawLeads = (parsed.leads ?? parsed.lead_list ?? []) as any[];
        const sanitized = rawLeads.map(sanitizeLead);
        const { valid, rejectedCount } = validateLeadList(sanitized);
        const finalLeads = valid.length > 0 ? valid : sanitized;
        return {
          format: 'list',
          agentType: 'researcher',
          taskId,
          leads: finalLeads,
          rawContent: `${finalLeads.length} leads generated (${rejectedCount} placeholder leads rejected)`,
        } as LeadListArtifact;
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
      } as ResearchArtifact;
    }

    case 'analyst':
      return {
        format: 'structured_json',
        agentType: 'analyst',
        taskId,
        swot: (parsed.swot as any) ?? undefined,
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
        dataPoints: Array.isArray(parsed.dataPoints) ? parsed.dataPoints : [],
        recommendedNiche: String(parsed.recommendedNiche ?? parsed.recommended_niche ?? ''),
        riskLevel: (parsed.riskLevel as any) ?? 'medium',
        rawContent: String(parsed.rawContent ?? ''),
      } as AnalysisArtifact;

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
      } as StrategyArtifact;

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
      } as ContentArtifact;
    }

    default: {
      const body = JSON.stringify(parsed, null, 2);
      return {
        format: 'prose',
        agentType: agentType as 'writer',
        taskId,
        body,
        wordCount: body.split(/\s+/).length,
        rawContent: body,
      } as ContentArtifact;
    }
  }
}

const LEAD_PLACEHOLDER_PATTERNS = [
  /\bjohn\s+doe\b/i, /\bjane\s+doe\b/i, /\bacme\b/i, /\bexample\b/i,
  /\btest\s+user\b/i, /\blorem\b/i, /\bplaceholder\b/i, /\btodo\b/i,
  /\byour\s+name\b/i, /\bcompany\s+name\b/i, /\bxyz\s+corp\b/i,
  /\[.*?\]/,
];

function isPlaceholderLead(lead: any): boolean {
  if (!lead || typeof lead !== 'object') return true;
  const text = `${lead.name ?? ''} ${lead.company ?? ''} ${lead.role ?? ''}`;
  return LEAD_PLACEHOLDER_PATTERNS.some(p => p.test(text)) ||
         !lead.painPoint || String(lead.painPoint).length < 15;
}

function validateLeadList(leads: any[]): { valid: any[]; rejectedCount: number } {
  const valid: any[] = [];
  let rejectedCount = 0;
  for (const lead of leads) {
    if (isPlaceholderLead(lead)) {
      rejectedCount++;
    } else {
      valid.push(lead);
    }
  }
  return { valid, rejectedCount };
}

function sanitizeLead(raw: any): any {
  return {
    name:          raw.name          ?? '[Not identified]',
    company:       raw.company       ?? raw.organization ?? '[Company unknown]',
    role:          raw.role          ?? raw.title        ?? raw.position ?? '[Role unknown]',
    location:      raw.location      ?? raw.city         ?? '',
    niche:         raw.niche         ?? raw.sector       ?? '',
    painPoint:     raw.painPoint     ?? raw.pain_point   ?? raw.challenge ?? '',
    outreachHook:  raw.outreachHook  ?? raw.outreach_hook ?? raw.hook ?? '',
    linkedInSearch: raw.linkedInSearch ?? raw.linkedin_search ?? `"${raw.role}" "${raw.niche}"`,
    dataSource:    'estimated',
  };
}
