import { analyticsEngine } from '../sales/analyticsEngine.js';
import { approvalService } from '../sales/approvalService.js';
import { getSupabase } from '../storage/supabaseClient.js';
import { salesAgent } from '../sales/salesAgent.js';
import { logger } from '../logger.js';

export interface DigestResult {
  metrics: any;
  pendingApprovals: number;
  staleLeads: number;
  recommendations: string[];
}

class DigestService {
  async getDigest(userId: string): Promise<DigestResult> {
    try {
      // 0. Lazy Cron: Run daily background tasks (like scheduled follow-ups)
      const supabase = await getSupabase();
      
      // Fetch user metadata to check last run
      const { data: { user } } = await supabase.auth.admin.getUserById(userId);
      const metadata = user?.user_metadata || {};
      const lastRunStr = metadata.last_daily_run;
      
      const now = new Date();
      let shouldRun = true;
      
      if (lastRunStr) {
         const lastRun = new Date(lastRunStr);
         const diffHours = (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60);
         if (diffHours < 20) {
            shouldRun = false;
         }
      }
      
      if (shouldRun) {
         logger.info(`[DigestService] Triggering lazy cron for user ${userId}`);
         // Fire and forget
         salesAgent.runScheduledFollowUps(userId).catch(e => logger.error(`Lazy cron failed: ${e.message}`));
         
         // Update timestamp
         await supabase.auth.admin.updateUserById(userId, {
            user_metadata: { ...metadata, last_daily_run: now.toISOString() }
         });
      }

      // 1. Get metrics
      const metrics = await analyticsEngine.getFunnelMetrics(userId, 7);
      
      // 2. Get pending approvals
      const pendingApprovalsList = await approvalService.listPending(userId);
      const pendingApprovals = pendingApprovalsList.length;
      
      // 3. Get stale leads (qualified but uncontacted for 5+ days)
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
      
      const { count: staleLeadsCount, error } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'qualified')
        .is('last_contacted_at', null)
        .lte('created_at', fiveDaysAgo.toISOString());
        
      if (error) {
        logger.warn(`[DigestService] Failed to fetch stale leads: ${error.message}`);
      }
      
      const staleLeads = staleLeadsCount || 0;
      
      // 4. Generate Nex's recommendations based on the data
      const recommendations: string[] = [];
      
      if (pendingApprovals > 0) {
        recommendations.push(`You have ${pendingApprovals} emails waiting for your approval. Should I send them?`);
      }
      
      if (staleLeads > 0) {
        recommendations.push(`There are ${staleLeads} hot leads sitting idle. Would you like me to draft outreach for them?`);
      }
      
      if (metrics.by_status?.new > 0) {
         recommendations.push(`You have ${metrics.by_status.new} unscored leads. Do you want me to qualify them now?`);
      }
      
      if (recommendations.length === 0) {
         recommendations.push("Your pipeline is clean. Nothing urgent right now. Want me to find more leads?");
      }

      return {
        metrics,
        pendingApprovals,
        staleLeads,
        recommendations
      };
    } catch (err: any) {
      logger.error(`[DigestService] Failed to generate digest: ${err.message}`);
      throw err;
    }
  }
}

export const digestService = new DigestService();
