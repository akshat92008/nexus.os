import { approvalService } from './approvalService.js';
import { emailDriver } from '../integrations/drivers/emailDriver.js';
import { getSupabase } from '../storage/supabaseClient.js';
import { logger } from '../logger.js';

export class EmailSenderService {
  /**
   * Approve an email draft and send it immediately.
   */
  async approveAndSend(approvalId: string, userId: string, updatedBody?: string): Promise<{ sent: boolean; error?: string }> {
    try {
      // 1. Resolve approval in DB
      const approval = await approvalService.resolve(approvalId, userId, 'approve', updatedBody);

      // 2. Send email via driver
      const result = await (emailDriver as any).execute({
        to: approval.to_email,
        subject: approval.subject,
        body: approval.body,
      }, userId);

      if (!result.success) {
        const errorMsg = result.error || 'Unknown send failure';
        await approvalService.markFailed(approvalId, errorMsg);
        return { sent: false, error: errorMsg };
      }

      // 3. Mark as sent in approval service
      await approvalService.markSent(approvalId);

      // 4. Update follow_up_sequences
      const supabase = await getSupabase();
      const { error: seqError } = await supabase
        .from('follow_up_sequences')
        .update({ 
          status: 'sent', 
          sent_at: new Date().toISOString() 
        })
        .eq('approval_id', approvalId);

      if (seqError) {
        logger.error(`[EmailSender] Failed to update follow_up_sequences: ${seqError.message}`);
      }

      // 5. Insert lead event
      if (approval.lead_id) {
        const { error: eventError } = await supabase
          .from('lead_events')
          .insert({
            lead_id: approval.lead_id,
            event_type: 'email_sent',
            payload: {
              step: approval.step,
              provider: result.data?.provider || 'unknown'
            }
          });
        
        if (eventError) {
          logger.error(`[EmailSender] Failed to insert lead event: ${eventError.message}`);
        }

        // Update lead status to 'contacted'
        const { error: leadUpdateError } = await supabase
          .from('leads')
          .update({ status: 'contacted' })
          .eq('id', approval.lead_id)
          .neq('status', 'booked')
          .neq('status', 'lost');

        if (leadUpdateError) {
          logger.error(`[EmailSender] Failed to update lead status: ${leadUpdateError.message}`);
        }

      }

      return { sent: true };
    } catch (error: any) {
      logger.error(`[EmailSender] approveAndSend error: ${error.message}`);
      return { sent: false, error: error.message };
    }
  }

  /**
   * Reject an email draft.
   */
  async reject(approvalId: string, userId: string): Promise<void> {
    try {
      await approvalService.resolve(approvalId, userId, 'reject');
    } catch (error: any) {
      logger.error(`[EmailSender] reject error: ${error.message}`);
      throw error;
    }
  }
}

export const emailSender = new EmailSenderService();
