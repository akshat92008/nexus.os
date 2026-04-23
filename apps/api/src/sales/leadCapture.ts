import { getSupabase } from '../storage/supabaseClient.js';
import { logger } from '../logger.js';
import { randomUUID } from 'crypto';

export interface LeadInput {
  email: string;
  name?: string;
  company?: string;
  role?: string;
  source: 'web_form' | 'email' | 'linkedin' | 'manual' | 'api';
  raw_data?: Record<string, any>;
  notes?: string;
}

export interface Lead extends LeadInput {
  id: string;
  user_id: string;
  score: number;
  status: string;
  follow_up_count: number;
  created_at: string;
  booked_at?: string;
  last_contacted_at?: string;
}

export class LeadCaptureService {
  async capture(userId: string, input: LeadInput): Promise<Lead> {
    try {
      if (!input.email) {
        throw new Error('email required');
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(input.email)) {
        throw new Error('invalid email');
      }

      const supabase = getSupabase();

      // Upsert lead
      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .upsert(
          {
            user_id: userId,
            email: input.email,
            name: input.name,
            company: input.company,
            role: input.role,
            source: input.source,
            raw_data: input.raw_data || {},
            notes: input.notes,
          },
          { onConflict: 'user_id,email' }
        )
        .select()
        .single();

      if (leadError) {
        logger.error(`[LeadCapture] Supabase error: ${leadError.message}`);
        throw new Error(leadError.message);
      }

      // Insert event
      const { error: eventError } = await supabase
        .from('lead_events')
        .insert({
          lead_id: lead.id,
          event_type: 'created',
          payload: { source: input.source }
        });

      if (eventError) {
        logger.error(`[LeadCapture] Event error: ${eventError.message}`);
      }

      const [local] = input.email.split('@');
      logger.info(`[LeadCapture] Lead captured: ${lead.id}, email: ${local}@***`);

      return lead as Lead;
    } catch (error: any) {
      const msg = error.message.startsWith('[LeadCapture]') ? error.message : `[LeadCapture] ${error.message}`;
      throw new Error(msg);
    }
  }

  async getLeads(userId: string, filters?: {
    status?: string;
    minScore?: number;
    source?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ leads: Lead[]; total: number }> {
    try {
      const supabase = await getSupabase();
      let query = supabase
        .from('leads')
        .select('*', { count: 'exact' })
        .eq('user_id', userId);

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.minScore !== undefined) {
        query = query.gte('score', filters.minScore);
      }
      if (filters?.source) {
        query = query.eq('source', filters.source);
      }

      const limit = Math.min(filters?.limit || 50, 200);
      const offset = filters?.offset || 0;

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        logger.error(`[LeadCapture] Supabase error: ${error.message}`);
        throw new Error(error.message);
      }

      return {
        leads: (data || []) as Lead[],
        total: count || 0
      };
    } catch (error: any) {
      const msg = error.message.startsWith('[LeadCapture]') ? error.message : `[LeadCapture] ${error.message}`;
      throw new Error(msg);
    }
  }

  async getLead(userId: string, leadId: string): Promise<Lead | null> {
    try {
      const supabase = await getSupabase();
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        logger.error(`[LeadCapture] Supabase error: ${error.message}`);
        throw new Error(error.message);
      }

      return data as Lead | null;
    } catch (error: any) {
      const msg = error.message.startsWith('[LeadCapture]') ? error.message : `[LeadCapture] ${error.message}`;
      throw new Error(msg);
    }
  }

  async updateLeadStatus(leadId: string, status: string, userId: string): Promise<void> {
    try {
      const supabase = await getSupabase();
      
      // Verification + Update
      const { data: lead, error: updateError } = await supabase
        .from('leads')
        .update({ status })
        .eq('id', leadId)
        .eq('user_id', userId)
        .select()
        .single();

      if (updateError) {
        logger.error(`[LeadCapture] Supabase error: ${updateError.message}`);
        throw new Error(updateError.message);
      }

      const { error: eventError } = await supabase
        .from('lead_events')
        .insert({
          lead_id: leadId,
          event_type: status,
          payload: {}
        });

      if (eventError) {
        logger.error(`[LeadCapture] Event error: ${eventError.message}`);
      }
    } catch (error: any) {
      const msg = error.message.startsWith('[LeadCapture]') ? error.message : `[LeadCapture] ${error.message}`;
      throw new Error(msg);
    }
  }
}

export const leadCapture = new LeadCaptureService();
