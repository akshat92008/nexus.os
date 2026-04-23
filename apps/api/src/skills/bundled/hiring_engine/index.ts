export const hiringEngineSkill = {
  name: 'hiring_engine',
  description: 'End-to-end hiring support: JDs, scorecards, interview plans, equity modeling',
  version: '1.0.0',
  tools: [
    {
      name: 'write_job_description',
      description: 'Write a high-conversion job description that attracts A-players',
      parameters: {
        role: { type: 'string' },
        level: { type: 'string', enum: ['ic', 'lead', 'manager', 'director', 'vp', 'c-suite'] },
        company_stage: { type: 'string', enum: ['pre-seed', 'seed', 'series-a', 'series-b', 'growth'] },
        must_haves: { type: 'string', description: 'Non-negotiable requirements' },
        nice_to_haves: { type: 'string' },
        what_they_will_build: { type: 'string', description: 'Concrete outcomes in first 6 months' },
        comp_range: { type: 'string' },
        equity_range: { type: 'string' }
      },
      execute: async (p: any) => ({
        prompt: `Write a job description for a ${p.level} ${p.role} at a ${p.company_stage} startup.
Rules: lead with mission and impact, not company boilerplate. Show the work they'll do, not just requirements.
List must-haves as 5 bullets max. Strike the word "passionate." Never say "startup environment."
Include a specific "Day 90" description — what does success look like? Show comp range (it increases applications 30%).

Must-haves: ${p.must_haves}
Nice-to-haves: ${p.nice_to_haves}
What they'll build: ${p.what_they_will_build}
Comp: ${p.comp_range} | Equity: ${p.equity_range}`
      })
    },
    {
      name: 'build_interview_scorecard',
      description: 'Create a structured interview scorecard to reduce bias and improve signal',
      parameters: {
        role: { type: 'string' },
        core_competencies: { type: 'string', description: 'The 4-6 things that predict success in this role' },
        interview_stages: { type: 'number', description: 'Number of interview rounds' }
      },
      execute: async (p: any) => ({
        prompt: `Create a structured interview scorecard for ${p.role}.
Core competencies to evaluate: ${p.core_competencies}
Across ${p.interview_stages} interview rounds.

For each competency provide:
- A behavioral question (STAR format)
- A work-sample or case question
- Green flags (signals of excellence)
- Red flags (disqualifying signals)
- 1-4 scoring rubric with behavioral anchors at each level
Structure so different interviewers cover different competencies — no duplication.
Final section: calibration questions for debrief to resolve disagreements.`
      })
    },
    {
      name: 'model_equity_grant',
      description: 'Model equity grant value and vesting for a candidate offer',
      parameters: {
        options_granted: { type: 'number' },
        total_shares_outstanding: { type: 'number' },
        current_valuation: { type: 'number' },
        strike_price_per_share: { type: 'number' },
        target_exit_multiples: { type: 'array', items: { type: 'number' }, description: 'e.g. [3, 5, 10]' },
        vesting_schedule: { type: 'string', description: 'e.g. "4-year with 1-year cliff"' }
      },
      execute: async (p: any) => {
        const ownershipPct = (p.options_granted / p.total_shares_outstanding) * 100;
        const currentPPS = p.current_valuation / p.total_shares_outstanding;
        const scenarios = p.target_exit_multiples.map((m: number) => ({
          multiple: m,
          exitValuation: p.current_valuation * m,
          ppsAtExit: currentPPS * m,
          grossValue: p.options_granted * (currentPPS * m - p.strike_price_per_share),
        }));
        return {
          ownershipPct,
          currentValuePerShare: currentPPS,
          scenarios,
          prompt: `Present this equity grant in plain language a candidate can understand.
Ownership: ${ownershipPct.toFixed(3)}%. Strike price: $${p.strike_price_per_share}.
Vesting: ${p.vesting_schedule}.
Scenario values at ${p.target_exit_multiples.join('x, ')}x exit: ${scenarios.map((s: any) => `$${s.grossValue.toLocaleString()} gross at ${s.multiple}x`).join(', ')}.
Explain dilution risk, tax implications (ISO vs NSO), and what questions the candidate should ask.`
        };
      }
    }
  ]
};
