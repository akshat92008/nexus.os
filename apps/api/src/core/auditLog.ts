/**
 * Nexus OS — Audit Log & Cost Tracking System
 *
 * Every action is logged for compliance, debugging, and cost analysis.
 * Provides structured tracing across all sub-agents and skills.
 */

import { getSupabase } from '../storage/supabaseClient.js';

export interface AuditEntry {
  id?: string;
  timestamp: string;
  userId: string;
  missionId?: string;
  agentType: string; // 'BUSINESS_AGENT' | 'DEV_AGENT' | 'SYS_AGENT' | 'LIFE_AGENT'
  actionType: string;
  toolId?: string;
  params: Record<string, any>;
  result?: 'success' | 'failure' | 'timeout' | 'abort';
  errorMessage?: string;
  tokensUsed: number;
  costEstimate: number; // in USD
  latencyMs: number;
  approved: boolean;
  autoExecuted: boolean;
  metadata?: Record<string, any>;
}

export interface CostSummary {
  totalCalls: number;
  totalTokens: number;
  totalCost: number;
  byAgent: Record<string, { calls: number; tokens: number; cost: number }>;
  byDay: Record<string, { calls: number; tokens: number; cost: number }>;
}

class AuditLog {
  private buffer: AuditEntry[] = [];
  private flushInterval?: NodeJS.Timeout;
  private readonly BATCH_SIZE = 50;
  private readonly FLUSH_MS = 5000;

  constructor() {
    this.flushInterval = setInterval(() => this.flush(), this.FLUSH_MS);
  }

  async log(entry: Omit<AuditEntry, 'timestamp'>): Promise<void> {
    const fullEntry: AuditEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };
    this.buffer.push(fullEntry);

    if (this.buffer.length >= this.BATCH_SIZE) {
      await this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const batch = this.buffer.splice(0, this.BATCH_SIZE);
    const supabase = await getSupabase();

    const rows = batch.map(e => ({
      user_id: e.userId,
      mission_id: e.missionId,
      agent_type: e.agentType,
      action_type: e.actionType,
      tool_id: e.toolId,
      params: e.params,
      result: e.result,
      error_message: e.errorMessage,
      tokens_used: e.tokensUsed,
      cost_estimate: e.costEstimate,
      latency_ms: e.latencyMs,
      approved: e.approved,
      auto_executed: e.autoExecuted,
      metadata: e.metadata,
      created_at: e.timestamp,
    }));

    const { error } = await supabase.from('audit_log').insert(rows);
    if (error) {
      console.error('[AuditLog] Failed to persist batch:', error.message);
      // Re-buffer on failure to avoid data loss
      this.buffer.unshift(...batch);
    }
  }

  async getRecent(userId: string, limit = 100): Promise<AuditEntry[]> {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Audit query failed: ${error.message}`);
    return (data || []).map(this.deserialize);
  }

  async getCostSummary(userId: string, days = 30): Promise<CostSummary> {
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('audit_log')
      .select('agent_type, tokens_used, cost_estimate, created_at')
      .eq('user_id', userId)
      .gte('created_at', since);

    if (error) throw new Error(`Cost query failed: ${error.message}`);

    const summary: CostSummary = {
      totalCalls: 0,
      totalTokens: 0,
      totalCost: 0,
      byAgent: {},
      byDay: {},
    };

    for (const row of data || []) {
      summary.totalCalls++;
      summary.totalTokens += row.tokens_used || 0;
      summary.totalCost += parseFloat(row.cost_estimate) || 0;

      const agent = row.agent_type || 'unknown';
      summary.byAgent[agent] = summary.byAgent[agent] || { calls: 0, tokens: 0, cost: 0 };
      summary.byAgent[agent].calls++;
      summary.byAgent[agent].tokens += row.tokens_used || 0;
      summary.byAgent[agent].cost += parseFloat(row.cost_estimate) || 0;

      const day = (row.created_at as string).slice(0, 10);
      summary.byDay[day] = summary.byDay[day] || { calls: 0, tokens: 0, cost: 0 };
      summary.byDay[day].calls++;
      summary.byDay[day].tokens += row.tokens_used || 0;
      summary.byDay[day].cost += parseFloat(row.cost_estimate) || 0;
    }

    return summary;
  }

  async getMissionTrace(missionId: string): Promise<AuditEntry[]> {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .eq('mission_id', missionId)
      .order('created_at', { ascending: true });

    if (error) throw new Error(`Trace query failed: ${error.message}`);
    return (data || []).map(this.deserialize);
  }

  private deserialize(row: any): AuditEntry {
    return {
      id: row.id,
      timestamp: row.created_at,
      userId: row.user_id,
      missionId: row.mission_id,
      agentType: row.agent_type,
      actionType: row.action_type,
      toolId: row.tool_id,
      params: row.params || {},
      result: row.result,
      errorMessage: row.error_message,
      tokensUsed: row.tokens_used || 0,
      costEstimate: parseFloat(row.cost_estimate) || 0,
      latencyMs: row.latency_ms || 0,
      approved: row.approved,
      autoExecuted: row.auto_executed,
      metadata: row.metadata,
    };
  }

  destroy() {
    if (this.flushInterval) clearInterval(this.flushInterval);
    this.flush().catch(() => {});
  }
}

export const auditLog = new AuditLog();
