export const competitorIntelSkill = {
  name: 'competitor_intel',
  description: 'Real-time competitor research, battlecards, and strategic positioning',
  version: '1.0.0',
  tools: [
    {
      name: 'build_battlecard',
      description: 'Generate a sales battlecard for head-to-head competitor comparison',
      parameters: {
        our_product: { type: 'string', description: 'Product name and 2-sentence description' },
        our_strengths: { type: 'string', description: 'Comma-separated list of genuine strengths' },
        our_weaknesses: { type: 'string', description: 'Honest weaknesses (needed for accurate positioning)' },
        our_pricing: { type: 'string' },
        competitor_name: { type: 'string' },
        competitor_known_facts: { type: 'string', description: 'What you know about them: pricing, features, customers' }
      },
      execute: async (p: any) => ({
        prompt: `Create a sales battlecard for reps to use when competing against ${p.competitor_name}.

Our product: ${p.our_product}
Our strengths: ${p.our_strengths}
Our honest weaknesses: ${p.our_weaknesses}
Our pricing: ${p.our_pricing}
What we know about ${p.competitor_name}: ${p.competitor_known_facts}

Structure the battlecard as:
1. WHEN YOU HEAR THIS about ${p.competitor_name} — SAY THIS (3 specific objection handlers)
2. TRAPS TO AVOID — where they beat us and how to redirect, not lie
3. KILL QUESTIONS — discovery questions that expose their weaknesses naturally
4. PROOF POINTS — types of evidence/case studies that win this matchup
5. PRICING COUNTER — how to position our price when they're cheaper/more expensive
Keep it usable in a live sales call — short sentences, no jargon.`
      })
    },
    {
      name: 'positioning_map',
      description: 'Identify the unique positioning angle that no competitor owns',
      parameters: {
        market: { type: 'string', description: 'Market category (e.g. "CRM for SMBs")' },
        competitors: { type: 'string', description: 'List of main competitors and how they position' },
        our_unique_facts: { type: 'string', description: 'What is objectively true about us that is hard to copy' },
        icp: { type: 'string', description: 'Ideal customer profile description' }
      },
      execute: async (p: any) => ({
        prompt: `Map the competitive landscape for "${p.market}".
Competitors and their positioning: ${p.competitors}
Our objective differentiators: ${p.our_unique_facts}
Our ICP: ${p.icp}

Identify: the positioning white space no competitor owns, the "category of one" framing we should own,
the 3-word brand promise that is true, differentiated, and matters to our ICP,
and the messaging hierarchy: headline → proof points → emotional hook.`
      })
    }
  ]
};
