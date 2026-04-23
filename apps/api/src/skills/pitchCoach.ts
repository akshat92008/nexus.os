/**
 * Nexus OS — Pitch Coach Skill
 * Analyzes investor pitches, writes VC cold emails, generates data room checklists.
 */
import { llmRouter } from '../llm/LLMRouter.js';
import { MODEL_POWER } from '../agents/agentConfig.js';

export const pitchCoach = {
  id: 'pitch_coach',
  name: 'Pitch Coach',
  description: 'VC pitch analysis, cold email drafting, and data room generation',
  category: 'business',

  async analyzePitch(content: string, stage: string, sector: string): Promise<string> {
    const { content: result } = await llmRouter.call({
      model: MODEL_POWER,
      temperature: 0.3,
      maxTokens: 1200,
      system: `You are a partner-level VC who has reviewed 3,000+ pitches at top-tier firms.
Be surgical, not encouraging. Founders need truth, not validation.`,
      user: `Analyze this ${stage} pitch in the ${sector} sector.

Score each dimension 1-10 with a one-sentence critique and one concrete fix:
1. Problem clarity - is the pain visceral and specific, not theoretical?
2. Market size - TAM that is credible and defensible, not "global market is $X trillion"?
3. Solution differentiation - why this solution, why now, why this team?
4. Business model - is the unit economics logic airtight?
5. Traction - does the evidence match the claims, or is it vanity metrics?
6. Team - do these founders own this problem, or did they just read about it?
7. Ask clarity - does the investor know exactly what they're funding and at what terms?

End with: overall fundability score /100, the single biggest red flag, the single strongest signal, and the one sentence you'd say to a co-investor to explain why you passed or why you wired.

PITCH:
${content}`,
    });
    return result;
  },

  async writeColdEmail(params: {
    fundName: string; partnerName: string; partnerThesis: string;
    companyOneLiner: string; traction: string; ask: string;
  }): Promise<string> {
    const { content } = await llmRouter.call({
      model: MODEL_POWER,
      temperature: 0.4,
      maxTokens: 300,
      system: 'You write VC cold emails that get responses. You are a founder, not a supplicant.',
      user: `Write a VC cold email with these hard rules:
- Subject: specific reference to THEIR work or thesis, not generic
- Opening: one sentence connecting their thesis to our company - no flattery
- Traction: one concrete number that proves momentum
- Timing: one sentence on why now (market or company trigger)
- Ask: specific (15-min call), not vague ("explore synergies")
- Total length: under 120 words
- Tone: peer-to-peer

Fund: ${params.fundName} | Partner: ${params.partnerName}
Their thesis: ${params.partnerThesis}
Our company: ${params.companyOneLiner}
Traction: ${params.traction}
Ask: ${params.ask}`,
    });
    return content;
  },

  async generateDataRoom(stage: string, companyType: string): Promise<string> {
    const { content } = await llmRouter.call({
      model: MODEL_POWER,
      temperature: 0.2,
      maxTokens: 1000,
      system: 'You are a startup lawyer and operator who has run 50+ fundraising processes.',
      user: `Generate a complete data room checklist for a ${stage} ${companyType} company.
For each document: filename convention, required contents, and what investors scrutinize.
Group by: Company, Product, Financials, Legal, Team, Market.
Flag: non-negotiable (deal-stopper if missing) vs. nice-to-have at this stage.
Include estimated time to prepare each section.`,
    });
    return content;
  },
};
