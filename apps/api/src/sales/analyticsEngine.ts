import { getSupabase } from '../storage/supabaseClient.js';
import { llmRouter } from '../llm/LLMRouter.js';
import { logger } from '../logger.js';

const insightsCache = new Map<string, { insights: string[]; actions: string[]; expiresAt: number }>();

interface FunnelMetrics {
  period: string;
  total_leads: number;
  by_status: Record<string, number>;
  by_source: Record<string, number>;
  avg_score: number;
  hot_leads: number;
  conversion_rate: number;      // booked / total * 100
  follow_up_rate: number;       // contacted / qualified * 100
  avg_days_to_book: number;
  top_sources: Array<{ source: string; count: number; conversion: number }>;
}

interface InsightResult {
  metrics: FunnelMetrics;
  insights: string[];           // LLM-generated bullet points
  recommended_actions: string[];
}

export class AnalyticsEngineService {
  /**
   * Fetches leads for a user within a timeframe and calculates funnel metrics.
   */
  async getFunnelMetrics(userId: string, days: number = 30): Promise<FunnelMetrics> {
    try {
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const supabase = await getSupabase();
      
      const { data: leads, error } = await supabase
        .from('leads')
        .select('id, status, source, score, created_at, booked_at')
        .eq('user_id', userId)
        .gte('created_at', since);

      if (error) {
        logger.error(`[AnalyticsEngine] Error fetching leads: ${error.message}`);
        throw new Error(error.message);
      }

      const total_leads = leads?.length || 0;
      const by_status: Record<string, number> = {};
      const by_source: Record<string, number> = {};
      let totalScore = 0;
      let hot_leads = 0;
      let bookedCount = 0;
      let contactedCount = 0;
      let qualifiedCount = 0;
      let totalDaysToBook = 0;
      let leadsWithBookedAt = 0;

      const sourceStats: Record<string, { count: number; booked: number }> = {};

      for (const lead of leads || []) {
        // Group by status
        const status = lead.status || 'new';
        by_status[status] = (by_status[status] || 0) + 1;
        if (status === 'booked') bookedCount++;
        if (status === 'contacted') contactedCount++;
        if (status === 'qualified') qualifiedCount++;

        // Group by source
        const source = lead.source || 'unknown';
        by_source[source] = (by_source[source] || 0) + 1;

        // Score analytics
        const score = lead.score || 0;
        totalScore += score;
        if (score >= 70) hot_leads++;

        // Cycle time: created -> booked
        if (lead.booked_at) {
          const created = new Date(lead.created_at).getTime();
          const booked = new Date(lead.booked_at).getTime();
          if (!isNaN(created) && !isNaN(booked)) {
            totalDaysToBook += (booked - created) / 86400000;
            leadsWithBookedAt++;
          }
        }

        // Stats for source conversion
        if (!sourceStats[source]) {
          sourceStats[source] = { count: 0, booked: 0 };
        }
        sourceStats[source].count++;
        if (status === 'booked') {
          sourceStats[source].booked++;
        }
      }

      const avg_score = total_leads > 0 ? totalScore / total_leads : 0;
      const conversion_rate = total_leads > 0 ? (bookedCount / total_leads) * 100 : 0;
      const follow_up_rate = (contactedCount / (qualifiedCount || 1)) * 100;
      const avg_days_to_book = leadsWithBookedAt > 0 ? totalDaysToBook / leadsWithBookedAt : 0;

      // Top 5 sources by lead volume
      const top_sources = Object.entries(sourceStats)
        .map(([source, stats]) => ({
          source,
          count: stats.count,
          conversion: (stats.booked / stats.count) * 100
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        period: `${days} days`,
        total_leads,
        by_status,
        by_source,
        avg_score,
        hot_leads,
        conversion_rate,
        follow_up_rate,
        avg_days_to_book,
        top_sources
      };
    } catch (err: any) {
      logger.error(`[AnalyticsEngine] getFunnelMetrics failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Generates LLM-based insights from funnel metrics.
   */
  async getInsights(userId: string, days: number = 30): Promise<InsightResult> {
    const metrics = await this.getFunnelMetrics(userId, days);
    
    const cacheKey = `${userId}_${days}`;
    const cached = insightsCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      logger.debug(`[AnalyticsEngine] Serving cached insights for ${userId}`);
      return { metrics, insights: cached.insights, recommended_actions: cached.actions };
    }

    const INSIGHT_PROMPT = `You are a B2B sales analyst. Given these funnel metrics, provide:
        - 3 key insights (what's working, what's broken)
        - 3 specific actions to improve conversion
        Be direct, data-driven. No generic advice.
        Output ONLY valid JSON: {"insights":["..."],"recommended_actions":["..."]}`;
    
    const metricsStr = JSON.stringify(metrics, null, 2);
    
    try {
      const raw = await llmRouter.callSimple(INSIGHT_PROMPT, metricsStr, 'MODEL_FAST', true);
      
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        logger.error(`[AnalyticsEngine] JSON parse error: ${e}. Raw: ${raw}`);
        parsed = { insights: [], recommended_actions: [] };
      }
      
      const insights = Array.isArray(parsed.insights) ? parsed.insights : [];
      const recommended_actions = Array.isArray(parsed.recommended_actions) ? parsed.recommended_actions : [];
      
      insightsCache.set(cacheKey, {
        insights,
        actions: recommended_actions,
        expiresAt: Date.now() + 60 * 60 * 1000 // 1 hour TTL
      });

      logger.info(`[AnalyticsEngine] Generated ${insights.length} insights for user ${userId}`);
      
      return { metrics, insights, recommended_actions };
    } catch (error: any) {
      logger.error(`[AnalyticsEngine] Failed to get insights: ${error.message}`);
      return {
        metrics,
        insights: [],
        recommended_actions: []
      };
    }
  }
}


export const analyticsEngine = new AnalyticsEngineService();
