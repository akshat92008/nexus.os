import { llmRouter } from '../llm/LLMRouter.js';
import { approvalService } from './approvalService.js';
import { getSupabase } from '../storage/supabaseClient.js';
import { logger } from '../logger.js';

const REPLY_PROMPT = `You are a professional B2B sales rep writing on behalf of the business owner.
Write a short, personalized email reply to this lead. Rules:
- Max 120 words
- Warm but professional tone
- End with a clear single call-to-action (book a call, reply with availability, etc.)
- Do NOT mention AI, automation, or that this was generated
- Match the lead's level of formality. Tailor your language and tone specifically to their role and industry (e.g., formal for enterprise, casual for creatives).
Output ONLY valid JSON in this exact format:
{"subject": "compelling subject line here", "body": "email body here"}
No markdown blocks, no other text.`;

const FOLLOWUP_PROMPT = `You are a B2B sales rep writing a follow-up email.
This lead has not responded in {days} days. Write a gentle follow-up.
Rules:
- Max 80 words
- Different angle than previous outreach
- One clear CTA
- Do NOT say "just checking in" or "circling back"
- Tailor your language and tone specifically to their role and industry (e.g., formal for enterprise, casual for creatives).
Output ONLY valid JSON in this exact format:
{"subject": "compelling subject line here", "body": "email body here"}
No markdown blocks, no other text.`;

interface DraftResult {
  approvalId: string;
  leadId: string;
  subject: string;
  body: string;
  to: string;
  step: number;
}

export class SalesAgentService {
  private async callLLMWithRetry(system: string, user: string, tier: string): Promise<string> {
    const withTimeout = (promise: Promise<any>, ms: number) => {
      let timer: NodeJS.Timeout;
      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('LLM Timeout')), ms);
      });
      return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
    };

    try {
      return await withTimeout(llmRouter.callSimple(system, user, tier), 10000);
    } catch (error) {
      logger.warn(`[SalesAgent] LLM call failed, retrying once after 1000ms delay...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return await withTimeout(llmRouter.callSimple(system, user, tier), 10000);
    }
  }
  private async getUserBusinessContext(userId: string): Promise<string> {
    try {
      const supabase = await getSupabase();
      const { data, error } = await supabase.auth.admin.getUserById(userId);
      if (error || !data.user) return '';
      return data.user.user_metadata?.business_context || '';
    } catch (e) {
      return '';
    }
  }


  async draftReply(
    leadId: string,
    userId: string,
    context: { leadName?: string; leadCompany?: string; leadEmail: string; inboundMessage?: string; subject?: string; role?: string; }
  ): Promise<DraftResult> {
    try {
      const businessContext = await this.getUserBusinessContext(userId);
      const userPrompt = `Context about the sender's business:
${businessContext || 'No business context provided.'}

Lead: ${context.leadName || 'Unknown'}
Company: ${context.leadCompany || 'Unknown'}
Role: ${context.role || 'Unknown'}
Email: ${context.leadEmail}
Their message: ${context.inboundMessage || 'No message provided'}

Please draft a response tailored to this lead's role and industry.`;

      const raw = await this.callLLMWithRetry(REPLY_PROMPT, userPrompt, 'MODEL_FAST');
      let parsed = { subject: context.subject || `Re: Your inquiry`, body: raw };
      try {
        const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();
        parsed = JSON.parse(cleaned);
      } catch (e) {
        logger.warn(`[SalesAgent] Failed to parse JSON reply: ${raw}`);
      }
      
      const subject = parsed.subject;
      const body = `${parsed.body}\n\n---\nTo unsubscribe, please reply with "Unsubscribe".`;

      // Queue for approval (persistent)
      const approval = await approvalService.create({
        userId,
        leadId,
        toEmail: context.leadEmail,
        subject,
        body,
        step: 1
      });

      const supabase = await getSupabase();
      
      // Insert follow-up sequence row
      const { error: seqError } = await supabase
        .from('follow_up_sequences')
        .insert({
          lead_id: leadId,
          user_id: userId,
          step: 1,
          status: 'pending',
          message_subject: subject,
          message_body: body,
          approval_id: approval.id,
          scheduled_at: new Date().toISOString()
        });

      if (seqError) throw seqError;

      // Insert lead event
      await supabase
        .from('lead_events')
        .insert({
          lead_id: leadId,
          event_type: 'draft_created',
          payload: { step: 1, approval_id: approval.id }
        });

      return {
        approvalId: approval.id,
        leadId,
        subject,
        body,
        to: context.leadEmail,
        step: 1
      };
    } catch (error: any) {
      logger.error(`[SalesAgent] Error in draftReply: ${error.message}`);
      throw error;
    }
  }

  async draftFollowUp(
    leadId: string,
    userId: string,
    daysSinceContact: number
  ): Promise<DraftResult> {
    try {
      const supabase = await getSupabase();

      // Fetch lead
      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .eq('user_id', userId)
        .single();

      if (leadError || !lead) throw new Error('Lead not found');
      if (lead.status === 'booked' || lead.status === 'lost') {
        throw new Error('Lead not eligible for follow-up');
      }

      // Fetch latest step and previous message body
      const { data: latest } = await supabase
        .from('follow_up_sequences')
        .select('step, message_body')
        .eq('lead_id', leadId)
        .order('step', { ascending: false })
        .limit(1)
        .maybeSingle();

      const step = (latest?.step || 0) + 1;
      if (step > 3) throw new Error('Max follow-up steps reached (3)');
      const prevBody = latest?.message_body || 'None';

      const businessContext = await this.getUserBusinessContext(userId);
      const systemPrompt = FOLLOWUP_PROMPT.replace('{days}', daysSinceContact.toString());
      const userPrompt = `Context about the sender's business:
${businessContext || 'No business context provided.'}

Lead: ${lead.name || 'Unknown'}
Company: ${lead.company || 'Unknown'}
Role: ${lead.role || 'Unknown'}

Previous email sent to this lead:
"""
${prevBody}
"""
Please write a DIFFERENT angle based on this context, tailored to their role and industry.`;
      const raw = await this.callLLMWithRetry(systemPrompt, userPrompt, 'MODEL_FAST');
      
      let parsed = { subject: step === 2 ? 'Following up' : 'Last note from me', body: raw };
      try {
        const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();
        parsed = JSON.parse(cleaned);
      } catch (e) {
        logger.warn(`[SalesAgent] Failed to parse JSON followup: ${raw}`);
      }

      const subject = parsed.subject;
      const body = `${parsed.body}\n\n---\nTo unsubscribe, please reply with "Unsubscribe".`;

      // Queue for approval (persistent)
      const approval = await approvalService.create({
        userId,
        leadId,
        toEmail: lead.email!,
        subject,
        body,
        step
      });

      // Insert follow-up sequence row
      await supabase.from('follow_up_sequences').insert({
        lead_id: leadId,
        user_id: userId,
        step,
        status: 'pending',
        message_subject: subject,
        message_body: body,
        approval_id: approval.id,
        scheduled_at: new Date().toISOString()
      });

      // Update leads
      await supabase
        .from('leads')
        .update({
          follow_up_count: (lead.follow_up_count || 0) + 1,
          last_contacted_at: new Date().toISOString()
        })
        .eq('id', leadId);

      return {
        approvalId: approval.id,
        leadId,
        subject,
        body,
        to: lead.email!,
        step
      };
    } catch (error: any) {
      logger.error(`[SalesAgent] Error in draftFollowUp: ${error.message}`);
      throw error;
    }
  }

  async runScheduledFollowUps(userId: string): Promise<{ triggered: number; skipped: number; errors: number }> {
    let triggered = 0;
    let skipped = 0;
    let errors = 0;

    try {
      const supabase = await getSupabase();
      
      const { data: sequences } = await supabase
        .from('follow_up_sequences')
        .select(`
          id,
          lead_id,
          created_at,
          leads (
            id,
            email,
            name,
            company,
            status,
            last_contacted_at
          )
        `)
        .eq('user_id', userId)
        .eq('status', 'pending')
        .lte('scheduled_at', new Date().toISOString())
        .limit(10);

      for (const seq of (sequences || [])) {
        try {
          const lead = seq.leads as any;
          if (!lead) { errors++; continue; }

          if (lead.status === 'booked' || lead.status === 'lost') {
            await supabase
              .from('follow_up_sequences')
              .update({ status: 'skipped' })
              .eq('id', seq.id);
            skipped++;
            continue;
          }

          const lastContacted = lead.last_contacted_at ? new Date(lead.last_contacted_at) : new Date(seq.created_at);
          const daysSince = Math.floor((Date.now() - lastContacted.getTime()) / (1000 * 60 * 60 * 24));

          await this.draftFollowUp(lead.id, userId, daysSince);
          
          await supabase
            .from('follow_up_sequences')
            .update({ status: 'processed' })
            .eq('id', seq.id);

          triggered++;
        } catch (err: any) {
          logger.error(`[SalesAgent] Error processing scheduled follow-up ${seq.id}: ${err.message}`);
          errors++;
        }
      }

      return { triggered, skipped, errors };
    } catch (error: any) {
      logger.error(`[SalesAgent] Error in runScheduledFollowUps: ${error.message}`);
      throw error;
    }
  }
}

export const salesAgent = new SalesAgentService();
