export const legalGuardSkill = {
  name: 'legal_guard',
  description: 'Contract red-flag detection, terms drafting, compliance checklist generation. NOT legal advice — always review with a lawyer.',
  version: '1.0.0',
  disclaimer: 'This skill identifies issues for discussion with legal counsel. It does not constitute legal advice.',
  tools: [
    {
      name: 'review_contract_redflags',
      description: 'Scan a contract for founder-unfriendly clauses and missing protections',
      parameters: {
        contract_text: { type: 'string' },
        contract_type: { type: 'string', enum: ['saas-agreement', 'employment', 'advisor', 'nda', 'term-sheet', 'vendor', 'partnership'] },
        our_role: { type: 'string', enum: ['buyer', 'seller', 'employer', 'employee', 'both'] }
      },
      execute: async (p: any) => ({
        prompt: `IMPORTANT: Flag for review with legal counsel — this is not legal advice.

Review this ${p.contract_type} where we are the ${p.our_role}. Flag:
1. CRITICAL red flags — clauses that could cause serious harm (unlimited liability, IP assignment traps, perpetual non-competes, unilateral termination for convenience with no notice)
2. MISSING protections — standard clauses that should be there but aren't (limitation of liability, indemnification caps, IP ownership clarity, data processing terms)
3. AMBIGUOUS terms — language that is dangerously vague and could be interpreted against us
4. NEGOTIATION points — things we should push back on, with suggested alternative language

For each issue: quote the exact clause, explain the risk in plain English, suggest the fix.

CONTRACT:
${p.contract_text}`
      })
    },
    {
      name: 'generate_gdpr_checklist',
      description: 'Generate a GDPR compliance checklist tailored to the product type',
      parameters: {
        product_type: { type: 'string', description: 'What the product does' },
        data_types_collected: { type: 'string', description: 'What personal data you collect' },
        user_locations: { type: 'string', description: 'Where your users are based' }
      },
      execute: async (p: any) => ({
        prompt: `Generate a practical GDPR compliance checklist for a ${p.product_type} that collects: ${p.data_types_collected}. Users are in: ${p.user_locations}.
For each item: what it is, whether it applies to us, how to implement it, and the priority (P0/P1/P2).
Group by: Lawful basis, Data subject rights, Privacy by design, Vendor/processor agreements, Breach notification, DPO requirement.
Flag which gaps create the highest regulatory risk.`
      })
    },
    {
      name: 'draft_terms_of_service',
      description: 'Draft a plain-English terms of service outline for a SaaS product',
      parameters: {
        product_name: { type: 'string' },
        product_description: { type: 'string' },
        payment_model: { type: 'string', enum: ['subscription', 'usage-based', 'one-time', 'freemium'] },
        user_generated_content: { type: 'boolean' },
        ai_features: { type: 'boolean', description: 'Does the product include AI/LLM features?' }
      },
      execute: async (p: any) => ({
        prompt: `Draft a Terms of Service structure for ${p.product_name} — a ${p.product_description}.
Payment model: ${p.payment_model}. User-generated content: ${p.user_generated_content}. AI features: ${p.ai_features}.

For each ToS section provide: the section name, what it must cover, and key clauses that protect the company.
Include if AI features: model output disclaimers, hallucination liability limitation, user responsibility for AI-generated content.
Write in plain English — no legalese — but ensure it is protective. Flag sections that need a lawyer to finalize.`
      })
    }
  ]
};
