export const pitchCoachSkill = {
  name: 'pitch_coach',
  description: 'Analyzes and improves investor pitch decks, cold emails, and fundraising narratives',
  version: '1.0.0',
  tools: [
    {
      name: 'analyze_pitch',
      description: 'Score a pitch deck or narrative against VC evaluation criteria',
      parameters: {
        content: { type: 'string', description: 'Pitch text, deck outline, or cold email' },
        stage: { type: 'string', enum: ['pre-seed', 'seed', 'series-a', 'series-b'], description: 'Funding stage' },
        sector: { type: 'string', description: 'Industry/vertical' }
      },
      execute: async ({ content, stage, sector }: any) => {
        const prompt = `You are a partner-level VC who has reviewed 2000+ pitches.
Analyze this ${stage} pitch in the ${sector} sector.

Score each dimension 1-10 and give a one-sentence critique + one concrete fix:
1. Problem clarity — is the pain visceral and specific?
2. Market size — is the TAM credible and defensible, not "global market is $X trillion"?
3. Solution differentiation — why this, why now, why them?
4. Business model — is the revenue logic airtight?
5. Traction — does the evidence match the claims?
6. Team — do these founders own this problem?
7. Ask clarity — does the investor know exactly what they're being asked for?

End with: overall fundability score /100, the single biggest red flag, and the single strongest signal.

PITCH:
${content}`;
        return { prompt, schema: 'pitch_analysis' };
      }
    },
    {
      name: 'write_cold_email',
      description: 'Write a personalized VC cold email for a specific fund and partner',
      parameters: {
        fund_name: { type: 'string' },
        partner_name: { type: 'string' },
        partner_thesis: { type: 'string', description: 'Their stated investment thesis or recent portfolio' },
        company_one_liner: { type: 'string' },
        traction: { type: 'string', description: 'Key metrics or proof points' },
        ask: { type: 'string', description: 'What you want — intro call, check size, etc.' }
      },
      execute: async (params: any) => {
        const prompt = `Write a VC cold email following these rules:
- Subject line: specific, not generic ("Re: your Sequoia post on vertical SaaS" not "Exciting opportunity")
- Opening: one sentence connecting THEIR thesis to YOUR company — not flattery
- Traction line: one concrete number that proves momentum
- One sentence on why now (market timing)
- Ask: specific and easy (15-min call, not "partnership")
- Total length: under 120 words
- Tone: peer-to-peer, founder-to-investor, not supplicant

Fund: ${params.fund_name} | Partner: ${params.partner_name}
Their thesis: ${params.partner_thesis}
Our company: ${params.company_one_liner}
Traction: ${params.traction}
Ask: ${params.ask}`;
        return { prompt, schema: 'email_draft' };
      }
    },
    {
      name: 'generate_data_room',
      description: 'Generate a due diligence data room checklist and template structure for a given stage',
      parameters: {
        stage: { type: 'string', enum: ['pre-seed', 'seed', 'series-a'] },
        company_type: { type: 'string', enum: ['saas', 'marketplace', 'deeptech', 'consumer', 'fintech'] }
      },
      execute: async ({ stage, company_type }: any) => {
        const prompt = `Generate a complete data room structure for a ${stage} ${company_type} company.
For each document, specify: filename, what it must contain, and what investors will look for.
Group by: Company fundamentals, Product, Financials, Legal, Team, Market.
Flag which documents are non-negotiable vs. nice-to-have at this stage.`;
        return { prompt, schema: 'checklist' };
      }
    }
  ]
};
