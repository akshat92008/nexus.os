import { getSupabase } from '../storage/supabaseClient.js';
import { randomUUID } from 'crypto';
import { logger } from '../logger.js';

export interface Approval {
  id: string;
  user_id: string;
  lead_id: string | null;
  to_email: string;
  subject: string;
  body: string;
  step: number;
  status: 'pending' | 'approved' | 'rejected' | 'sent' | 'failed';
  created_at: string;
  resolved_at: string | null;
  sent_at: string | null;
  error: string | null;
}

export class ApprovalService {
  async create(params: {
    userId: string;
    leadId: string | null;
    toEmail: string;
    subject: string;
    body: string;
    step: number;
  }): Promise<Approval> {
    const id = `appr_${randomUUID().slice(0, 8)}`;
    const supabase = await getSupabase();

    const { data, error } = await supabase
      .from('email_approvals')
      .insert({
        id,
        user_id: params.userId,
        lead_id: params.leadId,
        to_email: params.toEmail,
        subject: params.subject,
        body: params.body,
        step: params.step,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create approval: ${error.message}`);
    }

    return data as Approval;
  }

  async listPending(userId: string): Promise<Approval[]> {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('email_approvals')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to list pending approvals: ${error.message}`);
    }

    return (data || []) as Approval[];
  }

  async listSent(userId: string): Promise<Approval[]> {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('email_approvals')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['sent', 'failed'])
      .order('sent_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to list sent approvals: ${error.message}`);
    }

    return (data || []) as Approval[];
  }

  async resolve(approvalId: string, userId: string, action: 'approve' | 'reject', updatedBody?: string): Promise<Approval> {
    const supabase = await getSupabase();
    
    const updatePayload: any = {
      status: action === 'approve' ? 'approved' : 'rejected',
      resolved_at: new Date().toISOString(),
    };
    if (updatedBody) {
      updatePayload.body = updatedBody;
    }

    const { data, error } = await supabase
      .from('email_approvals')
      .update(updatePayload)
      .eq('id', approvalId)
      .eq('user_id', userId)
      .eq('status', 'pending')
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Approval not found or not pending`);
    }

    logger.info({ approvalId, userId, action }, '[ApprovalService] Approval resolved');
    return data as Approval;
  }

  async markSent(approvalId: string): Promise<void> {
    const supabase = await getSupabase();
    const { error } = await supabase
      .from('email_approvals')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', approvalId);

    if (error) {
      throw new Error(`Failed to mark approval as sent: ${error.message}`);
    }
  }

  async markFailed(approvalId: string, errorMsg: string): Promise<void> {
    const supabase = await getSupabase();
    const { error } = await supabase
      .from('email_approvals')
      .update({ status: 'failed', error: errorMsg })
      .eq('id', approvalId);

    if (error) {
      throw new Error(`Failed to mark approval as failed: ${error.message}`);
    }
  }
}

export const approvalService = new ApprovalService();
