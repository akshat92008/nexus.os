/**
 * Nexus OS — Output Formatter v3 (Durable)
 * 
 * Hardened to handle malformed or partial LLM outputs.
 */

import type {
  GoalType,
  SynthesisArtifact,
  LeadProfile,
  PipelineStage,
  Workspace,
  WorkspaceSection,
  WorkspaceTask,
  TypedArtifact,
  KeyInsight,
  NextStep,
} from '@nexus-os/types';

// ── Domain-Specific Output Types ───────────────────────────────────────────

export interface LeadGenOutput {
  niche: string;
  executiveSummary: string;
  leads: LeadProfile[];
  pipeline?: { stages: PipelineStage[]; recommendedCRM?: string };
  outreachMessages?: Array<{ leadCompany: string; subject: string; body: string }>;
  keyInsights: string[];
  gaps: string[];
  nextSteps: Array<{ action: string; timeframe: string; priority: string }>;
}

export interface ResearchOutput {
  executiveSummary: string;
  keyInsights: Array<{ insight: string; confidence: string }>;
  recommendations: string[];
  gaps: string[];
  nextSteps: Array<{ action: string; timeframe: string }>;
}

export interface StrategyOutput {
  executiveSummary: string;
  roadmap: Array<{ phase: string; actions: string[]; timeline: string }>;
  risks: Array<{ risk: string; mitigation: string }>;
  quickWins: string[];
  nextSteps: Array<{ action: string; timeframe: string }>;
}

export interface GeneralOutput {
  executiveSummary: string;
  keyInsights: Array<{ insight: string; confidence: string }>;
  deliverable: Record<string, unknown>;
  gaps: string[];
  nextSteps: Array<{ action: string; timeframe: string }>;
}

export type FormattedOutput =
  | { goalType: 'lead_gen'; data: LeadGenOutput }
  | { goalType: 'research'; data: ResearchOutput }
  | { goalType: 'strategy'; data: StrategyOutput }
  | { goalType: 'content'; data: GeneralOutput }
  | { goalType: 'analysis'; data: GeneralOutput }
  | { goalType: 'code'; data: GeneralOutput }
  | { goalType: 'general'; data: GeneralOutput };

// ── Helpers ───────────────────────────────────────────────────────────────

function ensureArray<T = unknown>(val: unknown): T[] {
  if (Array.isArray(val)) return val as T[];
  if (val == null) return [];
  return [val as T];
}

function formatLead(raw: any): LeadProfile {
  if (!raw) return { name: 'Unknown', company: 'Unknown', role: 'Unknown', location: '', niche: '', painPoint: '', outreachHook: '', linkedInSearch: '', googleSearch: '', dataSource: 'estimated', verificationNote: '' };
  
  return {
    name:    raw.name ?? '[Name not identified]',
    company: raw.company ?? raw.organization ?? '[Company TBD]',
    role:    raw.role ?? raw.title ?? raw.position ?? '[Role TBD]',
    location: raw.location ?? raw.city ?? '',
    niche:   raw.niche ?? raw.sector ?? raw.industry ?? '',
    painPoint:    raw.painPoint ?? raw.pain_point ?? raw.challenge ?? '',
    outreachHook: raw.outreachHook ?? raw.outreach_hook ?? raw.hook ?? '',
    linkedInSearch: raw.linkedInSearch ?? `"${raw.role ?? ''}" "${raw.niche ?? ''}"`.trim(),
    googleSearch: `"${raw.company ?? ''}" "${raw.role ?? ''}"`.trim(),
    dataSource: raw.dataSource === 'real' ? 'real' : 'estimated',
    verificationNote: raw.dataSource === 'real' ? '✅ Verified' : '⚠️ Tentative',
  };
}

// ── Domain Rules ──────────────────────────────────────────────────────────

const leadGenRule = {
  format(synthesis: SynthesisArtifact): LeadGenOutput {
    const d = (synthesis.deliverable ?? {}) as Record<string, any>;
    const rawLeads = ensureArray<any>(d.leads ?? d.lead_list ?? []).map(formatLead);

    return {
      niche: String(d.niche ?? synthesis.keyInsights?.[0]?.insight ?? 'Unspecified'),
      executiveSummary: synthesis.executiveSummary || 'Lead generation complete.',
      leads: rawLeads,
      pipeline: d.pipeline ?? d.sales_pipeline,
      outreachMessages: ensureArray<any>(d.outreachMessages ?? d.outreach_messages),
      keyInsights: ensureArray<KeyInsight>(synthesis.keyInsights).map((i) => i.insight),
      gaps: ensureArray<string>(synthesis.gaps),
      nextSteps: ensureArray<NextStep>(synthesis.nextSteps),
    };
  },
};

const researchRule = {
  format(synthesis: SynthesisArtifact): ResearchOutput {
    return {
      executiveSummary: synthesis.executiveSummary || 'Research complete.',
      keyInsights: ensureArray<KeyInsight>(synthesis.keyInsights).map((i) => ({
        insight: i.insight || 'No insight provided',
        confidence: i.confidence || 'medium',
      })),
      recommendations: ensureArray<string>((synthesis.deliverable as any)?.recommendations),
      gaps: ensureArray<string>(synthesis.gaps),
      nextSteps: ensureArray<NextStep>(synthesis.nextSteps),
    };
  },
};

const strategyRule = {
  format(synthesis: SynthesisArtifact): StrategyOutput {
    const d = (synthesis.deliverable ?? {}) as Record<string, any>;
    return {
      executiveSummary: synthesis.executiveSummary || 'Strategy finalized.',
      roadmap: ensureArray<any>(d.roadmap),
      risks: ensureArray<any>(d.risks),
      quickWins: ensureArray<string>(d.quickWins),
      nextSteps: ensureArray<NextStep>(synthesis.nextSteps),
    };
  },
};

const generalRule = {
  format(synthesis: SynthesisArtifact): GeneralOutput {
    return {
      executiveSummary: synthesis.executiveSummary || 'Task complete.',
      keyInsights: ensureArray<KeyInsight>(synthesis.keyInsights).map((i) => ({
        insight: i.insight || 'Info block',
        confidence: i.confidence || 'high',
      })),
      deliverable: (synthesis.deliverable ?? {}) as Record<string, any>,
      gaps: ensureArray<string>(synthesis.gaps),
      nextSteps: ensureArray<NextStep>(synthesis.nextSteps),
    };
  },
};

const DOMAIN_RULES: any = {
  lead_gen: leadGenRule,
  research: researchRule,
  strategy: strategyRule,
  content:  generalRule,
  analysis: generalRule,
  code:     generalRule,
  general:  generalRule,
};
// ── Workspace Transformation (V3) ──────────────────────────────────────────

export function transformToWorkspace(
  synthesis: SynthesisArtifact,
  goal: string,
  goalType: GoalType,
  missionId: string,
  intermediateArtifacts: Map<string, TypedArtifact>
): Workspace {
  const sections: WorkspaceSection[] = [];
  const d = (synthesis.deliverable ?? {}) as Record<string, any>;

  // 1. Insights
  sections.push({
    id: 'sec_insights',
    type: 'insight',
    title: 'Executive Insights',
    content: ensureArray(synthesis.keyInsights).length > 0 
      ? ensureArray(synthesis.keyInsights).map(i => ({ insight: i.insight, confidence: i.confidence || 'high' }))
      : [{ insight: 'Synthesis complete.', confidence: 'high' }],
    description: synthesis.executiveSummary || 'Strategizing next steps...',
  });

  // 2. Data/Table
  const rawLeads = ensureArray((d as any).leads ?? (d as any).lead_list ?? (d as any).dataPoints);
  if (rawLeads.length > 0) {
    sections.push({
      id: 'sec_table',
      type: 'table',
      title: goalType === 'lead_gen' ? 'Qualified Leads' : 'Structured Data',
      content: rawLeads.map(formatLead),
      description: `Collected ${rawLeads.length} entries.`,
    });
  }

  // 3. Roadmap/Tasks
  const roadmapRaw = ensureArray((d as any).roadmap ?? (d as any).pipeline?.stages ?? synthesis.nextSteps);
  const tasks: WorkspaceTask[] = roadmapRaw.map((phase: any, i: number) => ({
    id: `task_${i}`,
    title: phase.action ?? phase.label ?? phase.title ?? String(phase),
    status: 'pending',
    priority: phase.priority ?? 'medium',
  }));

  sections.push({
    id: 'sec_tasks',
    type: 'tasklist',
    title: 'Actionable Roadmap',
    content: tasks.length > 0 ? tasks : [{ id: 't1', title: 'Review output', status: 'pending', priority: 'high' }],
    description: 'Derived from mission synthesis.',
  });

  // 4. Document Content
  if ((d as any).body || (d as any).document || (d as any).notes || (d as any).code) {
    sections.push({
      id: 'sec_doc',
      type: 'document',
      title: 'Final Deliverable',
      content: String((d as any).body ?? (d as any).document ?? (d as any).notes ?? (d as any).code ?? ''),
      description: 'Human-readable result.',
    });
  }

  return {
    id: missionId,
    goal,
    goalType,
    sections,
    createdAt: Date.now(),
    metadata: { tokensUsed: 0, durationMs: 0 }
  };
}

export function formatStudentToWorkspace(data: any, goal: string, id: string): Workspace {
  return transformToWorkspace({ 
    executiveSummary: data.explanation, 
    keyInsights: ensureArray(data.keyPoints).map(p => ({ insight: p, confidence: 'high' })),
    deliverable: { notes: data.notes, ...data },
    gaps: [],
    nextSteps: []
  } as any, goal, 'research', id, new Map());
}

export function formatFounderToWorkspace(data: any, goal: string, id: string): Workspace {
  return transformToWorkspace({
    executiveSummary: data.executiveSummary,
    keyInsights: ensureArray(data.keyInsights).map(i => ({ insight: i, confidence: 'high' })),
    deliverable: { ...data },
    gaps: [],
    nextSteps: ensureArray(data.actionPlan).map(a => ({ action: a, priority: 'high' }))
  } as any, goal, 'strategy', id, new Map());
}

export function formatDeveloperToWorkspace(data: any, goal: string, id: string): Workspace {
  return transformToWorkspace({
    executiveSummary: data.explanation,
    keyInsights: ensureArray(data.improvements).map(i => ({ insight: i, confidence: 'high' })),
    deliverable: { ...data },
    gaps: [],
    nextSteps: ensureArray(data.steps).map(s => ({ action: s, priority: 'high' }))
  } as any, goal, 'code', id, new Map());
}

/**
 * Legacy compatibility
 */
export function formatOutput(synthesis: SynthesisArtifact, goalType: GoalType): FormattedOutput {
  const rule = DOMAIN_RULES[goalType] ?? generalRule;
  return { goalType, data: rule.format(synthesis) } as any;
}

export function formattedOutputToLegacyContent(output: FormattedOutput): string {
  return JSON.stringify(output.data, null, 2);
}

