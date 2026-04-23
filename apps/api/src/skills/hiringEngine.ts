/**
 * Nexus OS — Hiring Engine Skill
 * Job descriptions, interview scorecards, equity modeling.
 */
import { llmRouter } from '../llm/LLMRouter.js';
import { MODEL_POWER } from '../agents/agentConfig.js';

export const hiringEngine = {
  id: 'hiring_engine',
  name: 'Hiring Engine',
  description: 'Job descriptions, interview scorecards, and equity grant modeling',
  category: 'business',

  async writeJobDescription(params: {
    role: string; level: string; stage: string;
    mustHaves: string; niceToHaves: string;
    whatTheyWillBuild: string; compRange: string; equityRange: string;
  }): Promise<string> {
    const { content } = await llmRouter.call({
      model: MODEL_POWER, temperature: 0.5, maxTokens: 800,
      system: 'You write job descriptions that attract A-players and repel mis-fits. You never use corporate jargon.',
      user: `Write a job description for a ${params.level} ${params.role} at a ${params.stage} startup.

Rules: lead with mission and impact, not boilerplate. Show the WORK, not just requirements.
Must-haves: max 5 bullets. Never use the word "passionate." Never say "startup environment" or "fast-paced."
Include a concrete "Day 90" - what does success look like? This is your best hire signal.
Always show comp and equity range - it increases qualified applications by 30%.

Must-haves: ${params.mustHaves}
Nice-to-haves: ${params.niceToHaves}
What they'll own: ${params.whatTheyWillBuild}
Comp: ${params.compRange} | Equity: ${params.equityRange}`,
    });
    return content;
  },

  async buildInterviewScorecard(role: string, coreCompetencies: string, numRounds: number): Promise<string> {
    const { content } = await llmRouter.call({
      model: MODEL_POWER, temperature: 0.3, maxTokens: 1000,
      system: 'You design structured interviews that reduce bias and surface real signal.',
      user: `Create a structured interview scorecard for ${role} across ${numRounds} rounds.
Core competencies: ${coreCompetencies}

For each competency:
- Behavioral question (STAR format)
- Work-sample or live problem question
- Green flags (signals of excellence in the answer)
- Red flags (disqualifying signals)
- 1-4 scoring rubric with behavioral anchors at each level

Assign each competency to one round only (no duplication across interviewers).
Final section: calibration questions for the debrief to resolve interviewers who disagree.`,
    });
    return content;
  },

  modelEquityGrant(params: {
    optionsGranted: number; totalSharesOutstanding: number;
    currentValuation: number; strikePricePerShare: number;
    targetExitMultiples: number[]; vestingSchedule: string;
  }) {
    const ownershipPct   = (params.optionsGranted / params.totalSharesOutstanding) * 100;
    const currentPPS     = params.currentValuation / params.totalSharesOutstanding;

    const scenarios = params.targetExitMultiples.map(m => {
      const exitPPS   = currentPPS * m;
      const grossValue = params.optionsGranted * (exitPPS - params.strikePricePerShare);
      return {
        multiple:      m,
        exitValuation: Math.round(params.currentValuation * m),
        grossValue:    Math.round(Math.max(grossValue, 0)),
        netNote:       'Before tax. ISOs taxed at exercise + sale. NSOs taxed as ordinary income at exercise.',
      };
    });

    return {
      ownershipPct:     Math.round(ownershipPct * 1000) / 1000,
      currentValuePerShare: Math.round(currentPPS * 100) / 100,
      strikePricePerShare: params.strikePricePerShare,
      vestingSchedule:  params.vestingSchedule,
      scenarios,
      candidateSummary: `${ownershipPct.toFixed(3)}% ownership, ${params.vestingSchedule}. At ${params.targetExitMultiples.map(m => `${m}x exit: $${Math.round(scenarios.find(s => s.multiple === m)!.grossValue).toLocaleString()} gross`).join(', ')}.`,
    };
  },
};
