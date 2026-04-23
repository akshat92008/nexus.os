import { llmRouter } from '../llm/LLMRouter.js';
import { emailDriver } from '../integrations/drivers/emailDriver.js';
import { queueApproval, approvalQueue } from '../integrations/approvalSystem.js';
import { getSupabase } from '../storage/supabaseClient.js';
import { logger } from '../logger.js';
import { randomUUID } from 'crypto';

const REPLY_PROMPT = `You are a professional B2B sales rep writing on behalf of the business owner.
Write a short, personalized email reply to this lead. Rules:
- Max 120 words
- Warm but professional tone
- End with a clear single call-to-action (book a call, reply with availability, etc.)
- Do NOT mention AI, automation, or that this was generated
- Match the lead's level of formality
Output ONLY the email body text. No subject line. No signature placeholder.`;

const FOLLOWUP_PROMPT = `You are a B2B sales rep writing a follow-up email.
This lead has not responded in {days} days. Write a gentle follow-up.
Rules:
- Max 80 words
- Different angle than previous outreach
- One clear CTA
- Do NOT say "just checking in" or "circling back"
Output ONLY email body. No subject line.`;

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
    try {
      return await llmRouter.callSimple(system, user, tier);
    } catch (error) {
      logger.warn(`[SalesAgent] LLM call failed, retrying once after 1000ms delay...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return await llmRouter.callSimple(system, user, tier);
    }
  }

  async draftReply(
    leadId: string,
    userId: string,
    context: { leadName?: string; leadCompany?: string; leadEmail: string; inboundMessage?: string; subject?: string; }
  ): Promise<DraftResult> {
    try {
      const userPrompt = `Lead: ${context.leadName || 'Unknown'} from ${context.leadCompany || 'Unknown'}
Email: ${context.leadEmail}
Their message: ${context.inboundMessage || 'No message provided'}`;

      const body = await this.callLLMWithRetry(REPLY_PROMPT, userPrompt, 'MODEL_FAST');
      const subject = context.subject || `Re: Your inquiry`;

      // Queue for CEO approval
      const approval = queueApproval('send_email', { to: context.leadEmail, subject, body }, userId);

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
          message_body: body
        });

      if (seqError) throw seqError;

      // Insert lead event (emailed)
      const { error: eventError } = await supabase
        .from('lead_events')
        .insert({
          lead_id: leadId,
          event_type: 'emailed',
          payload: { step: 1, approval_id: approval.id }
        });

      if (eventError) throw eventError;

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
        .single();

      if (leadError || !lead) throw new Error('Lead not found');
      if (lead.status === 'booked' || lead.status === 'lost') {
        throw new Error('Lead not eligible for follow-up');
      }

      // Fetch latest follow_up_sequences row for this lead to get step count
      const { data: latest, error: seqError } = await supabase
        .from('follow_up_sequences')
        .select('step')
        .eq('lead_id', leadId)
        .order('step', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (seqError) throw seqError;

      const step = (latest?.step || 0) + 1;
      if (step > 3) {
        throw new Error('Max follow-up steps reached (3)');
      }

      const systemPrompt = FOLLOWUP_PROMPT.replace('{days}', daysSinceContact.toString());
      const userPrompt = `Lead: ${lead.name || 'Unknown'} from ${lead.company || 'Unknown'}`;
      const body = await this.callLLMWithRetry(systemPrompt, userPrompt, 'MODEL_FAST');
      
      const subject = step === 2 ? 'Following up' : 'Last note from me';

      // Queue for CEO approval
      const approval = queueApproval('send_email', { to: lead.email!, subject, body }, userId);

      // Insert follow-up sequence row
      await supabase.from('follow_up_sequences').insert({
        lead_id: leadId,
        user_id: userId,
        step,
        status: 'pending',
        message_subject: subject,
        message_body: body
      });

      // Insert lead event
      await supabase.from('lead_events').insert({
        lead_id: leadId,
        event_type: 'emailed',
        payload: { step, approval_id: approval.id }
      });

      // Update leads: follow_up_count += 1, last_contacted_at = NOW()
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

  async sendApproved(approvalId: string, userId: string): Promise<{ sent: boolean }> {
    try {
      // Fetch approval from approvalQueue
      const approval = approvalQueue.get(approvalId);
      if (!approval || approval.status !== 'pending') {
        throw new Error('Approval not found or already processed');
      }

      const { to, subject, body } = approval.params as any;

      // Call emailDriver.execute
      const result = await (emailDriver as any).execute({
        to,
        subject,
        body,
        from: process.env.FROM_EMAIL
      }, userId);

      if (!result.success) {
        throw new Error(result.error || 'Failed to send email');
      }

      // Update approval status to 'approved'
      approval.status = 'approved';
      approval.resolvedAt = Date.now();

      // Update follow_up_sequences: status='sent', sent_at=NOW() where draft has matching subject
      const supabase = await getSupabase();
      await supabase
        .from('follow_up_sequences')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('message_subject', subject)
        .eq('status', 'pending');

      return { sent: true };
    } catch (error: any) {
      logger.error(`[SalesAgent] Error in sendApproved: ${error.message}`);
      throw error;
    }
  }

  async runScheduledFollowUps(userId: string): Promise<{ triggered: number; skipped: number; errors: number }> {
    let triggered = 0;
    let skipped = 0;
    let errors = 0;

    try {
      const supabase = await getSupabase();
      
      const { data: sequences, error: seqError } = await supabase
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

      if (seqError) throw seqError;

      for (const seq of (sequences || [])) {
        try {
          const lead = seq.leads as any;
          if (!lead) {
            errors++;
            continue;
          }

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
          
          // Mark as processed to avoid re-triggering the same timer
          await supabase
            .from('follow_up_sequences')
            .update({ status: 'processed' })
            .eq('id', seq.id);

          triggered++;
          await new Promise(resolve => setTimeout(resolve, 500));
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

export async function registerFollowUpCron(cronManager: any, userId: string) {
  await cronManager.schedule({
    name: `sales-followup-${userId}`,
    mission_prompt: `Run scheduled follow-up emails for user ${userId}`,
    schedule_type: 'cron',
    cron_expression: '0 9 * * *',  // 9am daily
    is_active: true
  });
}

export const salesAgent = new SalesAgentService();
