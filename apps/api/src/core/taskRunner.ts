import { leadCapture } from '../sales/leadCapture.js';
import { leadScorer } from '../sales/leadScorer.js';
import { salesAgent } from '../sales/salesAgent.js';
import { analyticsEngine } from '../sales/analyticsEngine.js';
import { getSupabase } from '../storage/supabaseClient.js';
import { logger } from '../logger.js';

export interface TaskResult {
  summary: string;
  details: any;
}

class TaskRunner {
  async runTask(taskType: string, userId: string, params: any = {}): Promise<TaskResult> {
    logger.info(`[TaskRunner] Running task: ${taskType} for user ${userId}`);
    try {
      switch(taskType) {
        case 'process_leads':
          return await this.processLeads(userId, params);
        case 'run_outreach':
          return await this.runOutreach(userId, params);
        case 'follow_up':
          return await this.followUp(userId);
        case 'status_report':
          return await this.statusReport(userId, params);
        default:
          throw new Error(`Unknown task type: ${taskType}`);
      }
    } catch (err: any) {
      logger.error(`[TaskRunner] Task ${taskType} failed: ${err.message}`);
      throw err;
    }
  }

  private async processLeads(userId: string, params: any): Promise<TaskResult> {
    let imported = 0;
    if (params.csv) {
      const result = await leadCapture.importCSV(userId, params.csv);
      imported = result.count;
    }
    
    // Score unscored leads
    const scoreResult = await leadScorer.scoreBatch(userId, 50);
    
    // Note: leadScorer.scoreBatch already triggers salesAgent.draftFollowUp for hot leads (>=70)
    // based on our previous implementation.
    
    return {
      summary: `Processed leads. Imported ${imported}, scored ${scoreResult.scored}. ${scoreResult.hot} hot leads found and drafts queued.`,
      details: { imported, ...scoreResult }
    };
  }

  private async runOutreach(userId: string, params: any): Promise<TaskResult> {
    const supabase = await getSupabase();
    
    // Find qualified leads that haven't been contacted yet
    const { data: leads, error } = await supabase
      .from('leads')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'qualified')
      .is('last_contacted_at', null)
      .order('score', { ascending: false })
      .limit(params.limit || 10);

    if (error) throw error;
    
    let drafted = 0;
    for (const lead of leads || []) {
      try {
        await salesAgent.draftFollowUp(lead.id, userId, 0);
        drafted++;
      } catch (err: any) {
        logger.error(`[TaskRunner] Failed to draft for lead ${lead.id}: ${err.message}`);
      }
    }
    
    return {
      summary: `Drafted outreach for ${drafted} qualified leads. Check your approval queue.`,
      details: { drafted, attempted: (leads || []).length }
    };
  }

  private async followUp(userId: string): Promise<TaskResult> {
    const result = await salesAgent.runScheduledFollowUps(userId);
    return {
      summary: `Triggered ${result.triggered} scheduled follow-ups. Skipped ${result.skipped}.`,
      details: result
    };
  }

  private async statusReport(userId: string, params: any): Promise<TaskResult> {
    const days = params.days || 7;
    const result = await analyticsEngine.getInsights(userId, days);
    
    return {
      summary: `Pipeline status for last ${days} days: ${result.metrics.total_leads} leads, ${result.metrics.hot_leads} hot.`,
      details: result
    };
  }
}

export const taskRunner = new TaskRunner();
