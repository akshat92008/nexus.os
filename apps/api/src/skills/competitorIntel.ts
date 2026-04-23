/**
 * Nexus OS — Competitor Intelligence Skill
 * Battlecards, positioning maps, and win/loss analysis.
 */
import { llmRouter } from '../llm/LLMRouter.js';
import { MODEL_POWER } from '../agents/agentConfig.js';

export const competitorIntel = {
  id: 'competitor_intel',
  name: 'Competitor Intelligence',
  description: 'Sales battlecards, positioning strategy, and competitive positioning',
  category: 'business',

  async buildBattlecard(params: {
    ourProduct: string; ourStrengths: string; ourWeaknesses: string;
    ourPricing: string; competitorName: string; competitorFacts: string;
  }): Promise<string> {
    const { content } = await llmRouter.call({
      model: MODEL_POWER, temperature: 0.3, maxTokens: 900,
      system: 'You are a VP of Sales who has won and lost hundreds of competitive deals. Be ruthlessly practical.',
      user: `Create a sales battlecard for live use against ${params.competitorName}.

Our product: ${params.ourProduct}
Our genuine strengths: ${params.ourStrengths}
Our honest weaknesses: ${params.ourWeaknesses}
Our pricing: ${params.ourPricing}
What we know about ${params.competitorName}: ${params.competitorFacts}

Structure:
1. WHEN YOU HEAR THIS -> SAY THIS (3 specific objection handlers with exact language)
2. TRAPS TO AVOID - where they beat us; how to redirect without lying
3. KILL QUESTIONS - 3 discovery questions that expose their weaknesses naturally in a live call
4. PROOF POINTS - types of evidence/case studies that win this matchup specifically
5. PRICING COUNTER - how to position our price vs theirs (cheaper or more expensive)

Rules: short sentences, no jargon, usable mid-call without re-reading.`,
    });
    return content;
  },

  async findPositioningWhiteSpace(params: {
    market: string; competitors: string; ourUniqueFacts: string; icp: string;
  }): Promise<string> {
    const { content } = await llmRouter.call({
      model: MODEL_POWER, temperature: 0.4, maxTokens: 700,
      system: 'You are a positioning strategist. You find the gaps others are too timid to own.',
      user: `Map the competitive landscape for "${params.market}".
Competitors and their positioning: ${params.competitors}
Our objective differentiators: ${params.ourUniqueFacts}
Our ICP: ${params.icp}

Identify:
1. The positioning white space no competitor currently owns
2. The "category of one" frame we should claim (name the category, own it)
3. Our 3-word brand promise: true, differentiated, and matters to the ICP
4. Messaging hierarchy: headline -> 3 proof points -> emotional hook
5. The competitor most likely to copy our positioning and our pre-emptive move`,
    });
    return content;
  },
};
