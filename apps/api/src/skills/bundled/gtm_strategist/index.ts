export const gtmStrategistSkill = {
  name: 'gtm_strategist',
  description: 'Go-to-market strategy, ICP definition, channel selection, and launch planning',
  version: '1.0.0',
  tools: [
    {
      name: 'define_icp',
      description: 'Build a rigorous Ideal Customer Profile from existing customer data or assumptions',
      parameters: {
        best_customers: { type: 'string', description: 'Describe your best 3-5 customers: industry, size, role, what they bought, why they stayed' },
        worst_customers: { type: 'string', description: 'Describe churned or difficult customers and why' },
        your_unfair_advantage: { type: 'string' }
      },
      execute: async (p: any) => ({
        prompt: `Build a rigorous ICP (Ideal Customer Profile) from this data.

Best customers: ${p.best_customers}
Worst customers / churned: ${p.worst_customers}
Our unfair advantage: ${p.your_unfair_advantage}

Derive:
1. Firmographic profile (industry, company size, geography, funding stage, tech stack signals)
2. Champion profile (job title, seniority, goals, fears, how they buy)
3. Economic buyer profile (who signs the check)
4. Trigger events (what makes them suddenly need us — e.g. funding, headcount milestone, regulation change)
5. Disqualifiers (who we should NOT sell to)
6. Where to find them (channels, communities, events, signals)
7. First 3 sentences of a cold email to this ICP`
      })
    },
    {
      name: 'select_gtm_channels',
      description: 'Rank and score the best acquisition channels for the stage and ICP',
      parameters: {
        icp: { type: 'string' },
        stage: { type: 'string', enum: ['pre-product-market-fit', 'post-pmf-scaling', 'growth'] },
        team_size: { type: 'number' },
        monthly_budget: { type: 'number' },
        founder_strengths: { type: 'string', description: 'e.g. "technical, strong network in fintech, good writer"' }
      },
      execute: async (p: any) => ({
        prompt: `Rank GTM channels for a ${p.stage} company selling to: ${p.icp}.
Team: ${p.team_size} people. Budget: $${p.monthly_budget}/mo. Founder strengths: ${p.founder_strengths}.

Score each channel (1-10) on: fit with ICP, capital efficiency at this budget, speed to first signal, founder leverage.
Cover: outbound (cold email/LinkedIn), content/SEO, product-led growth, community, events, partnerships, paid ads, PR.
For the top 3 channels: exact first-90-day playbook with weekly actions.
What to NOT do at this stage and why.`
      })
    },
    {
      name: 'plan_product_launch',
      description: 'Create a launch plan for a new product or feature',
      parameters: {
        product_name: { type: 'string' },
        launch_date: { type: 'string' },
        target_outcome: { type: 'string', description: 'e.g. "500 signups, 3 paying customers, Product Hunt #1"' },
        channels_available: { type: 'string' },
        budget: { type: 'number' }
      },
      execute: async (p: any) => ({
        prompt: `Create a launch plan for ${p.product_name} launching on ${p.launch_date}.
Target: ${p.target_outcome}. Channels: ${p.channels_available}. Budget: $${p.budget}.

Deliver:
T-30 days: what to build, who to brief, waitlist/beta strategy
T-7 days: content to create, press outreach, community warm-up
Launch day: hour-by-hour checklist, who posts what where and when
T+7 days: follow-up sequences, retargeting, testimonial capture
Success metrics: leading indicators to watch daily, lagging indicators at 30 days.
The single highest-leverage action if launch underperforms target at T+3 days.`
      })
    }
  ]
};
