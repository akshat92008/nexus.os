/**
 * Nexus OS — GTM Strategist Skill
 * ICP definition, channel selection, launch planning.
 */
import { llmRouter } from '../llm/LLMRouter.js';
import { MODEL_POWER } from '../agents/agentConfig.js';

export const gtmStrategist = {
  id: 'gtm_strategist',
  name: 'GTM Strategist',
  description: 'ICP definition, acquisition channel ranking, and product launch planning',
  category: 'business',

  async defineIcp(bestCustomers: string, worstCustomers: string, unfairAdvantage: string): Promise<string> {
    const { content } = await llmRouter.call({
      model: MODEL_POWER, temperature: 0.4, maxTokens: 900,
      system: 'You build ICPs from real customer data, not theory. Be specific enough to use in a cold email.',
      user: `Build a rigorous ICP from this customer data.

Best customers: ${bestCustomers}
Churned/worst customers: ${worstCustomers}
Our unfair advantage: ${unfairAdvantage}

Derive:
1. Firmographic profile (industry, size, geography, funding stage, tech stack signals)
2. Champion profile (job title, seniority, goals, fears, buying process)
3. Economic buyer (who signs the contract and what they care about)
4. Trigger events (what makes them suddenly need us right now - not just someday)
5. Hard disqualifiers (who we must stop selling to)
6. Where to find them (exact channels, communities, signals, job posting patterns)
7. First 3 sentences of a cold email to this exact ICP`,
    });
    return content;
  },

  async selectChannels(params: {
    icp: string; stage: string; teamSize: number;
    monthlyBudget: number; founderStrengths: string;
  }): Promise<string> {
    const { content } = await llmRouter.call({
      model: MODEL_POWER, temperature: 0.4, maxTokens: 900,
      system: 'You are a GTM advisor who has helped 100+ B2B startups find their first 100 customers.',
      user: `Rank GTM channels for a ${params.stage} company selling to: ${params.icp}.
Team: ${params.teamSize}. Budget: $${params.monthlyBudget}/mo. Founder strengths: ${params.founderStrengths}.

Score each channel 1-10 on: ICP fit, capital efficiency at this budget, speed to first signal, founder leverage.
Cover: cold outbound, content/SEO, PLG, community, events, partnerships, paid ads, PR.
For the top 3 channels: exact first-90-day playbook with weekly actions.
What to explicitly NOT do at this stage and why (this is as important as what to do).`,
    });
    return content;
  },

  async planLaunch(params: {
    productName: string; launchDate: string; targetOutcome: string;
    channelsAvailable: string; budget: number;
  }): Promise<string> {
    const { content } = await llmRouter.call({
      model: MODEL_POWER, temperature: 0.4, maxTokens: 900,
      system: 'You have launched 30+ products. You know what actually moves metrics vs. what feels productive.',
      user: `Launch plan for ${params.productName} on ${params.launchDate}.
Target: ${params.targetOutcome}. Channels: ${params.channelsAvailable}. Budget: $${params.budget}.

Deliver:
T-30: what to build, waitlist/beta strategy, who to brief
T-7: content to create, press outreach, community warm-up
Launch day: hour-by-hour checklist - who posts what, where, and when
T+7: follow-up sequences, retargeting, testimonial capture
Success metrics: leading indicators to watch daily; lagging indicators at 30 days
Contingency: single highest-leverage move if launch underperforms at T+3 days`,
    });
    return content;
  },
};
