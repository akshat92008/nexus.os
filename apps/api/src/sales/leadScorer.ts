import { llmRouter } from '../llm/LLMRouter.js';
import { getSupabase } from '../storage/supabaseClient.js';
import { logger } from '../logger.js';
import { salesAgent } from './salesAgent.js';

const SCORE_PROMPT = `You are a B2B sales qualification expert.
Score this lead 0-100 based on buying intent and fit.
100 = perfect fit, ready to buy. 0 = spam or irrelevant.

Scoring criteria:
- Has business email (not gmail/yahoo/hotmail): +20 pts
- Has company name: +15 pts
- Has role/title: +10 pts
- Role implies decision-making power (CEO/Founder/Director/VP/Head/Owner): +20 pts
- Company context shows clear need: +15 pts
- Professional notes/message: +10 pts
- Source is linkedin or email (not web form): +10 pts

Respond ONLY with valid JSON:
{"score": <number 0-100>, "reasoning": "<one sentence>", "tier": "hot|warm|cold", "recommended_action": "call|email|nurture|disqualify"}`;

export interface ScoreResult {
  score: number;
  reasoning: string;
  tier: 'hot' | 'warm' | 'cold';
  recommended_action: 'call' | 'email' | 'nurture' | 'disqualify';
}

export class LeadScorerService {
  async scoreLead(leadId: string, userId: string): Promise<ScoreResult> {
    try {
      const supabase = await getSupabase();
      
      const { data: lead, error: fetchError } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .eq('user_id', userId)
        .single();

      if (fetchError || !lead) {
        throw new Error('Lead not found');
      }

      const context = `Email: ${lead.email}
Name: ${lead.name || 'unknown'}
Company: ${lead.company || 'unknown'}
Role: ${lead.role || 'unknown'}
Source: ${lead.source}
Notes: ${lead.notes || 'none'}`;

      const raw = await llmRouter.callSimple(SCORE_PROMPT, context, 'MODEL_FAST', true);
      
      let result: ScoreResult;
      try {
        result = JSON.parse(raw);
      } catch (parseErr) {
        logger.error(`[LeadScorer] Parse error: ${raw}`);
        result = { 
          score: 30, 
          reasoning: 'parse error', 
          tier: 'cold', 
          recommended_action: 'nurture' 
        };
      }

      // Clamp score
      result.score = Math.max(0, Math.min(100, result.score));

      // Determine status based on tier
      let status = 'new';
      if (result.recommended_action === 'disqualify') {
        status = 'lost';
      } else if (result.tier === 'hot' || result.tier === 'warm') {
        status = 'qualified';
      }

      // Update lead
      const { error: updateError } = await supabase
        .from('leads')
        .update({ score: result.score, status })
        .eq('id', leadId);

      if (updateError) {
        throw new Error(`Update error: ${updateError.message}`);
      }

      // Insert event
      const { error: eventError } = await supabase
        .from('lead_events')
        .insert({
          lead_id: leadId,
          event_type: 'scored',
          payload: result
        });

      if (eventError) {
        logger.error(`[LeadScorer] Event error: ${eventError.message}`);
      }

      logger.info({ leadId, score: result.score, tier: result.tier }, '[LeadScorer] Lead scored');
      
      return result;
    } catch (error: any) {
      const msg = error.message.startsWith('[LeadScorer]') ? error.message : `[LeadScorer] ${error.message}`;
      logger.error(msg);
      throw new Error(msg);
    }
  }

  async scoreBatch(userId: string, limit: number = 20): Promise<{ processed: number; errors: number }> {
    let processed = 0;
    let errors = 0;

    try {
      const supabase = await getSupabase();
      const { data: leads, error: fetchError } = await supabase
        .from('leads')
        .select('id')
        .eq('user_id', userId)
        .eq('score', 0)
        .eq('status', 'new')
        .order('created_at', { ascending: true })
        .limit(limit);

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      if (!leads || leads.length === 0) {
        return { processed: 0, errors: 0 };
      }

      for (const lead of leads) {
        try {
          const result = await this.scoreLead(lead.id, userId);
          processed++;
          
          if (result.score >= 70) {
            logger.info(`[LeadScorer] Lead ${lead.id} is HOT. Auto-drafting initial outreach...`);
            // Trigger auto-drafting asynchronously
            salesAgent.draftFollowUp(lead.id, userId, 0).catch(err => {
               logger.error(`[LeadScorer] Auto-draft failed for lead ${lead.id}: ${err.message}`);
            });
          }

          // Sequential delay
          await new Promise(r => setTimeout(r, 200));
        } catch (err: any) {
          logger.error(`[LeadScorer] Batch error for lead ${lead.id}: ${err.message}`);
          errors++;
        }
      }

      return { processed, errors };
    } catch (error: any) {
      logger.error(`[LeadScorer] Batch failure: ${error.message}`);
      return { processed, errors };
    }
  }
}

export const leadScorer = new LeadScorerService();
