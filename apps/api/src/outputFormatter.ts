import type {
  GoalType,
  SynthesisArtifact,
  LeadProfile,
  PipelineStage,
  Workspace,
  WorkspaceSection,
  WorkspaceTask,
  TypedArtifact,
} from '../../../packages/types/index.js';

// ── Domain-Specific Output Types (Legacy) ──────────────────────────────────

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

// ── Validation Error ───────────────────────────────────────────────────────

export class OutputValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OutputValidationError';
  }
}

// ── Lead Sanitizer ─────────────────────────────────────────────────────────

function formatLead(raw: any): LeadProfile {
  return {
    name:    raw.name ?? '[Name not identified]',
    company: raw.company ?? raw.organization ?? '[Company TBD]',
    role:    raw.role ?? raw.title ?? raw.position ?? '[Role TBD]',
    location: raw.location ?? raw.city ?? '',
    niche:   raw.niche ?? raw.sector ?? raw.industry ?? '',
    painPoint:    raw.painPoint ?? raw.pain_point ?? raw.challenge ?? '',
    outreachHook: raw.outreachHook ?? raw.outreach_hook ?? raw.hook ?? '',
    linkedInSearch: raw.linkedInSearch ??
      `"${raw.role ?? ''}" "${raw.niche ?? ''}" ${raw.location ?? ''}`.trim(),
    googleSearch: `"${raw.company ?? ''}" "${raw.role ?? ''}" ${raw.niche ?? ''}`.trim(),
    dataSource: raw.dataSource === 'real' ? 'real' : 'estimated',
    verificationNote: raw.dataSource === 'real'
      ? '✅ Sourced from available public data'
      : '⚠️ Representative profile based on market research. Verify on LinkedIn before outreach.',
  };
}

/**
 * Robustly ensure a value is an array. 
 * Handles cases where LLMs return objects instead of arrays.
 */
function ensureArray<T>(val: any): T[] {
  if (Array.isArray(val)) return val;
  if (!val) return [];
  // If it's a single object, wrap it
  if (typeof val === 'object' && Object.keys(val).length > 0) return [val as T];
  return [];
}


// ── Domain Rules (Legacy) ──────────────────────────────────────────────────

type DomainRule<T> = {
  validate: (synthesis: SynthesisArtifact) => void;
  format: (synthesis: SynthesisArtifact) => T;
};

const leadGenRule: DomainRule<LeadGenOutput> = {
  validate(synthesis) {
    const deliverable = synthesis.deliverable ?? {};
    const leads = (deliverable.leads ?? deliverable.lead_list ?? []) as unknown[];

    if (!Array.isArray(leads)) {
      throw new OutputValidationError(
        'Lead gen mission deliverable must contain a leads[] array. Got: ' +
        typeof leads
      );
    }
    if (leads.length < 3) {
      throw new OutputValidationError(
        `Lead gen mission must produce at least 3 leads. Got: ${leads.length}. ` +
        'The researcher agent may not have produced structured lead data.'
      );
    }
  },

  format(synthesis): LeadGenOutput {
    const d = synthesis.deliverable;
    const rawLeads = ((d.leads ?? d.lead_list ?? []) as any[]).map(formatLead);

    return {
      niche: String(d.niche ?? synthesis.keyInsights?.[0]?.insight ?? ''),
      executiveSummary: synthesis.executiveSummary,
      leads: rawLeads,
      pipeline: d.pipeline as any ?? d.sales_pipeline as any ?? undefined,
      outreachMessages: (d.outreachMessages ?? d.outreach_messages ?? []) as any[],
      keyInsights: synthesis.keyInsights.map((i) => i.insight),
      gaps: synthesis.gaps,
      nextSteps: synthesis.nextSteps,
    };
  },
};

const researchRule: DomainRule<ResearchOutput> = {
  validate(synthesis) {
    if (!synthesis.keyInsights || synthesis.keyInsights.length < 2) {
      throw new OutputValidationError(
        'Research mission must produce at least 2 key insights.'
      );
    }
  },
  format(synthesis): ResearchOutput {
    return {
      executiveSummary: synthesis.executiveSummary,
      keyInsights: synthesis.keyInsights.map((i) => ({
        insight: i.insight,
        confidence: i.confidence,
      })),
      recommendations: (synthesis.deliverable?.recommendations as string[]) ?? [],
      gaps: synthesis.gaps,
      nextSteps: synthesis.nextSteps,
    };
  },
};

const strategyRule: DomainRule<StrategyOutput> = {
  validate(synthesis) {
    const roadmap = synthesis.deliverable?.roadmap as any[];
    if (!Array.isArray(roadmap) || roadmap.length === 0) {
      throw new OutputValidationError(
        'Strategy mission deliverable must include a roadmap[] array.'
      );
    }
  },
  format(synthesis): StrategyOutput {
    return {
      executiveSummary: synthesis.executiveSummary,
      roadmap: (synthesis.deliverable?.roadmap as any[]) ?? [],
      risks: (synthesis.deliverable?.risks as any[]) ?? [],
      quickWins: (synthesis.deliverable?.quickWins as string[]) ?? [],
      nextSteps: synthesis.nextSteps,
    };
  },
};

const generalRule: DomainRule<GeneralOutput> = {
  validate(_synthesis) {},
  format(synthesis): GeneralOutput {
    return {
      executiveSummary: synthesis.executiveSummary,
      keyInsights: synthesis.keyInsights.map((i) => ({
        insight: i.insight,
        confidence: i.confidence,
      })),
      deliverable: synthesis.deliverable,
      gaps: synthesis.gaps,
      nextSteps: synthesis.nextSteps,
    };
  },
};

const DOMAIN_RULES: Partial<Record<GoalType, DomainRule<any>>> = {
  lead_gen: leadGenRule,
  research: researchRule,
  strategy: strategyRule,
  analysis: generalRule,
  content:  generalRule,
  code:     generalRule,
  general:  generalRule,
};

// ── Workspace Transformation Layer (V3) ────────────────────────────────────

export function transformToWorkspace(
  synthesis: SynthesisArtifact,
  goal: string,
  goalType: GoalType,
  missionId: string,
  intermediateArtifacts: Map<string, TypedArtifact>
): Workspace {
  const sections: WorkspaceSection[] = [];

  // 1. Always add Executive Summary / Insights
  sections.push({
    id: 'sec_insights',
    type: 'insight',
    title: 'Executive Insights',
    content: (synthesis.keyInsights?.length > 0) 
      ? synthesis.keyInsights.map(i => ({ insight: i.insight, confidence: i.confidence }))
      : [{ insight: 'Primary mission objectives completed. Synthesis in progress.', confidence: 'high' }],
    description: synthesis.executiveSummary || 'Strategizing next steps based on mission outcomes...',
  });

  // 2. Goal-Specific Sections (Enhanced for Density)
  const d = synthesis.deliverable as any;

  // Leads / Data → Table (Only if leads actually exist)
  if (goalType === 'lead_gen' || goalType === 'research' || d.leads || d.lead_list || d.dataPoints) {
    const rawLeads = (d.leads ?? d.lead_list ?? d.dataPoints ?? []) as any[];
    if (rawLeads.length > 0) {
      sections.push({
        id: 'sec_table',
        type: 'table',
        title: goalType === 'lead_gen' ? 'Qualified Leads' : 'Sourced Intelligence',
        content: rawLeads.map(formatLead),
        description: `Sourced ${rawLeads.length} entries for your workspace.`,
      });
    } else {
      // Don't show an empty table with placeholders — show an intelligence gap instead
      sections.push({
        id: 'sec_gap_table',
        type: 'insight',
        title: 'Intelligence Gap: Structured Data',
        content: [{ insight: 'Direct lookup did not yield structured database entries. Pivot to manual LinkedIn verification recommended.', confidence: 'medium' }],
        description: 'No structured leads were extracted in this wave. Re-running with focus on manual profiles...',
      });
    }
  }


  // Strategy / Roadmap → Tasklist (Always show a tasklist)
  const roadmapRaw = d.roadmap ?? d.pipeline?.stages ?? d.stages ?? synthesis.nextSteps ?? [];
  const roadmap = ensureArray(roadmapRaw);
  
  const tasks: WorkspaceTask[] = roadmap.flatMap((phase: any, i: number) => {

    // If it's a nextStep object from synthesis
    if (phase.action) {
      return [{
        id: `task_s_${i}`,
        title: phase.action,
        status: 'pending',
        priority: phase.priority ?? 'medium',
      }];
    }
    // If it's a phase object with actions
    const actions = (phase.actions ?? []) as string[];
    return actions.map((act, j) => ({
      id: `task_${i}_${j}`,
      title: act,
      status: 'pending',
      priority: (i === 0) ? 'high' : 'medium',
    }));
  });

  sections.push({
    id: 'sec_tasks',
    type: 'tasklist',
    title: 'Actionable Roadmap',
    content: tasks.length > 0 ? tasks : [
      { id: 't_01', title: 'Review mission outputs', status: 'pending', priority: 'high' },
      { id: 't_02', title: 'Determine next strategic move', status: 'pending', priority: 'medium' }
    ],
    description: 'Direct next-steps derived from agentic synthesis.',
  });

  // Content / Document (Only if applicable)
  if (goalType === 'content' || d.body || d.document) {
    sections.push({
      id: 'sec_doc',
      type: 'document',
      title: 'Draft Deliverable',
      content: d.body ?? d.document ?? d.text ?? 'Generating final draft...',
      description: 'Human-readable documentation generated by your writing team.',
    });
  }

  // Outreach Messages (Only if applicable)
  if (d.outreachMessages || d.outreach_messages) {
    const msgs = (d.outreachMessages ?? d.outreach_messages ?? []) as any[];
    sections.push({
      id: 'sec_outreach',
      type: 'document',
      title: 'Outreach Campaign',
      content: msgs.map((m: any) => 
        `### For ${m.leadCompany}\n**Subject:** ${m.subject}\n\n${m.body}`
      ).join('\n\n---\n\n'),
      description: 'Personalized outreach templates for direct execution.',
    });
  }

  return {
    id: missionId,
    goal,
    goalType,
    sections,
    createdAt: Date.now(),
    metadata: {
      tokensUsed: 0, // updated by orchestrator
      durationMs: 0,
    }
  };
}

export function formatStudentToWorkspace(
  rawStudentData: any, // StudentOutput
  goal: string,
  missionId: string
): Workspace {
  const sections: WorkspaceSection[] = [];

  // 1. Explanation & Key Points -> Insight Section
  sections.push({
    id: 'sec_explanation',
    type: 'insight',
    title: 'Topical Deep-Dive',
    content: (rawStudentData.keyPoints || []).map((p: string) => ({ insight: p, confidence: 'high' })),
    description: rawStudentData.explanation || 'Synthesizing topic mastery...',
  });

  // 2. Study Notes -> Document Section
  sections.push({
    id: 'sec_study_notes',
    type: 'document',
    title: 'Comprehensive Study Notes',
    content: rawStudentData.notes || 'Notes are being drafted...',
    description: 'Detailed markdown notes for long-term retention.',
  });

  // 3. Mock Exam / Questions -> Document Section (Exam Mode)
  if (rawStudentData.questions && rawStudentData.questions.length > 0) {
    const qContent = Array.isArray(rawStudentData.questions) 
      ? rawStudentData.questions.map((q: any) => 
          typeof q === 'string' ? `- ${q}` : `#### Q: ${q.question}\n**A:** ${q.answer}`
        ).join('\n\n')
      : rawStudentData.questions;

    sections.push({
      id: 'sec_exam_prep',
      type: 'document',
      title: 'Mock Exam & Practice Questions',
      content: qContent,
      description: 'Practice questions generated to test your understanding.',
    });
  }

  // 4. Quick Revision -> Insight Section (Footer)
  sections.push({
    id: 'sec_revision',
    type: 'insight',
    title: 'Quick Revision (TL;DR)',
    content: [{ insight: rawStudentData.quickRevision || 'Focus on the core concepts identified above.', confidence: 'high' }],
    description: 'High-density summary for last-minute review.',
  });

  return {
    id: missionId,
    goal,
    goalType: 'research', // Student missions are internally research-typed
    sections,
    createdAt: Date.now(),
    metadata: {
      tokensUsed: 0,
      durationMs: 0,
    }
  };
}

/**
 * formatFounderToWorkspace
 * 
 * Specialized transformation for Founder Mode.
 * Maps FounderOutput fields to boardroom-ready sections.
 */
export function formatFounderToWorkspace(
  rawFounderData: any,
  goal: string,
  missionId: string
): Workspace {
  const sections: WorkspaceSection[] = [];

  // 1. Executive Summary & Insights
  sections.push({
    id: 'sec_founder_insights',
    type: 'insight',
    title: 'Executive Intelligence',
    content: (rawFounderData.keyInsights || []).map((p: string) => ({ insight: p, confidence: 'high' })),
    description: rawFounderData.executiveSummary || 'Strategizing market entry...',
  });
  // 2. Opportunities & Risks
  sections.push({
    id: 'sec_founder_strat',
    type: 'insight',
    title: 'Strategic Landscape',
    content: [
      ...(rawFounderData.opportunities || []).map((o: string) => ({ insight: `Opportunity: ${o}`, confidence: 'high' as const })),
      ...(rawFounderData.risks || []).map((r: string) => ({ insight: `Risk: ${r}`, confidence: 'medium' as const })),
    ],
    description: 'High-level opportunities and tactical hurdles identified.',
  });

  // 1.1 SWOT Analysis (If available)
  if (rawFounderData.swot) {
    sections.push({
      id: 'sec_founder_swot',
      type: 'insight',
      title: 'SWOT Analysis Matrix',
      content: [
        { insight: `STRENGTHS: ${rawFounderData.swot.strengths.join(', ')}`, confidence: 'high' },
        { insight: `WEAKNESSES: ${rawFounderData.swot.weaknesses.join(', ')}`, confidence: 'medium' },
        { insight: `OPPORTUNITIES: ${rawFounderData.swot.opportunities.join(', ')}`, confidence: 'high' },
        { insight: `THREATS: ${rawFounderData.swot.threats.join(', ')}`, confidence: 'low' },
      ],
      description: 'Strategic analysis of internal and external factors.',
    });
  }

  // 3. Action Plan -> Tasklist
  sections.push({
    id: 'sec_founder_roadmap',
    type: 'tasklist',
    title: 'Growth Roadmap',
    content: (rawFounderData.actionPlan || []).map((step: string, i: number) => ({
      id: `f_task_${i}`,
      title: step,
      status: 'pending',
      priority: i === 0 ? 'high' : 'medium',
    })),
    description: 'Step-by-step execution plan for the founder.',
  });

  return {
    id: missionId,
    goal,
    goalType: 'strategy',
    sections,
    createdAt: Date.now(),
    metadata: {
      tokensUsed: 0,
      durationMs: 0,
    }
  };
}

/**
 * formatDeveloperToWorkspace
 * 
 * Specialized transformation for Developer Mode.
 * Focuses on Code Studio, Technical Steps, and Improvements.
 */
export function formatDeveloperToWorkspace(
  rawDevData: any,
  goal: string,
  missionId: string
): Workspace {
  const sections: WorkspaceSection[] = [];

  // 1. Technical Explanation
  sections.push({
    id: 'sec_dev_explanation',
    type: 'insight',
    title: 'Technical Specification',
    content: (rawDevData.improvements || []).map((p: string) => ({ insight: p, confidence: 'high' })),
    description: rawDevData.explanation || 'Deconstructing requirement...',
  });

  // 2. Code Block -> Document (Code Studio)
  sections.push({
    id: 'sec_dev_code',
    type: 'document',
    title: 'Code Studio',
    content: rawDevData.code || '// No code generated.',
    description: 'Production-ready implementation generated for your goal.',
  });

  // 2.1 Unit Tests (If available)
  if (rawDevData.unitTests) {
    sections.push({
      id: 'sec_dev_tests',
      type: 'document',
      title: 'Automated Test Suite',
      content: rawDevData.unitTests,
      description: 'Comprehensive test coverage (Vitest/Jest) for the implementation.',
    });
  }

  // 3. Implementation Steps -> Tasklist
  sections.push({
    id: 'sec_dev_steps',
    type: 'tasklist',
    title: 'Implementation Log',
    content: (rawDevData.steps || []).map((step: string, i: number) => ({
      id: `d_task_${i}`,
      title: step,
      status: 'pending',
      priority: 'high',
    })),
    description: 'Critical steps taken to build and verify the code.',
  });

  return {
    id: missionId,
    goal,
    goalType: 'code',
    sections,
    createdAt: Date.now(),
    metadata: {
      tokensUsed: 0,
      durationMs: 0,
    }
  };
}

// ── Legacy Compatibility ───────────────────────────────────────────────────

export function formatOutput(
  synthesis: SynthesisArtifact,
  goalType: GoalType
): FormattedOutput {
  const rule = DOMAIN_RULES[goalType] ?? generalRule;
  try {
    rule.validate(synthesis);
  } catch (err) {
    if (err instanceof OutputValidationError) {
      synthesis.gaps.push(`Output validation issue: ${err.message}`);
    } else {
      throw err;
    }
  }
  const data = rule.format(synthesis);
  return { goalType, data } as FormattedOutput;
}

export function formattedOutputToLegacyContent(output: FormattedOutput): string {
  return JSON.stringify(output.data, null, 2);
}
