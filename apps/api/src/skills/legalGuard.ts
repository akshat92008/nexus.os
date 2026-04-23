/**
 * Nexus OS — Legal Guard Skill
 * Contract red-flag detection, GDPR checklist, ToS drafting.
 * DISCLAIMER: identifies issues for legal counsel review — not legal advice.
 */
import { llmRouter } from '../llm/LLMRouter.js';
import { MODEL_POWER } from '../agents/agentConfig.js';

const DISCLAIMER = '\n\n---\n⚠️ This analysis is for discussion with legal counsel only. It does not constitute legal advice.';

export const legalGuard = {
  id: 'legal_guard',
  name: 'Legal Guard',
  description: 'Contract red-flag detection, compliance checklists, ToS drafting (not legal advice)',
  category: 'business',

  async reviewContractRedFlags(contractText: string, contractType: string, ourRole: string): Promise<string> {
    const { content } = await llmRouter.call({
      model: MODEL_POWER, temperature: 0.2, maxTokens: 1200,
      system: `You are a startup-savvy lawyer reviewing contracts for founder risk. Flag issues clearly.
IMPORTANT: Always note at the end that this is for review with legal counsel, not a legal opinion.`,
      user: `Review this ${contractType} where we are the ${ourRole}. Flag:

1. CRITICAL red flags - clauses causing serious harm: unlimited liability, IP assignment traps, perpetual non-competes, unilateral termination with no notice, auto-renewal with no cap
2. MISSING protections - standard clauses absent: liability cap, indemnification limits, IP ownership clarity, data processing terms, governing law
3. AMBIGUOUS terms - dangerously vague language that could be interpreted against us
4. NEGOTIATION points - things to push back on with suggested replacement language

For each: quote the clause verbatim, explain the risk in plain English, suggest the fix.

CONTRACT:
${contractText}`,
    });
    return content + DISCLAIMER;
  },

  async generateGdprChecklist(productType: string, dataTypesCollected: string, userLocations: string): Promise<string> {
    const { content } = await llmRouter.call({
      model: MODEL_POWER, temperature: 0.2, maxTokens: 900,
      system: 'You are a data protection expert. Be practical and prioritized, not exhaustive.',
      user: `GDPR compliance checklist for a ${productType} collecting: ${dataTypesCollected}. Users in: ${userLocations}.

For each item: what it is, whether it applies to us, how to implement it, and priority (P0 blocker / P1 high / P2 good-to-have).
Group by: Lawful basis, Data subject rights, Privacy by design, Processor agreements, Breach notification, DPO requirement.
Flag the top 3 gaps that create the highest regulatory risk and estimated fine exposure.`,
    });
    return content + DISCLAIMER;
  },

  async draftTosOutline(params: {
    productName: string; productDescription: string; paymentModel: string;
    userGeneratedContent: boolean; aiFeatures: boolean;
  }): Promise<string> {
    const { content } = await llmRouter.call({
      model: MODEL_POWER, temperature: 0.3, maxTokens: 900,
      system: 'You draft Terms of Service outlines that protect the company without alienating users.',
      user: `Terms of Service structure for ${params.productName} — ${params.productDescription}.
Payment: ${params.paymentModel}. User content: ${params.userGeneratedContent}. AI features: ${params.aiFeatures}.

For each ToS section: section name, what it must cover, key protective clauses.
${params.aiFeatures ? 'AI-specific sections required: model output disclaimers, hallucination liability limitation, user responsibility for AI-generated content, no-reliance clause for high-stakes decisions.' : ''}
Write in plain English but make it protective. Flag which sections need a lawyer to finalize before publishing.`,
    });
    return content + DISCLAIMER;
  },
};
