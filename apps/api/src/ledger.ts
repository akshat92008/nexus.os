/**
 * Nexus OS — Transaction Ledger (Pillar 4 · Micro-Monetization Engine)
 *
 * Every completed agent task costs $0.01 (the platform routing fee).
 * This module writes those micro-transactions to Supabase's
 * `Transaction_Ledger` table and emits real-time SSE events so the
 * TokenROI widget can update the user's cost counter live.
 *
 * Supabase Schema (run this DDL once in your Supabase SQL editor):
 * ─────────────────────────────────────────────────────────────────
 *   CREATE TABLE IF NOT EXISTS "Transaction_Ledger" (
 *     id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
 *     user_id      TEXT        NOT NULL,
 *     agent_id     TEXT        NOT NULL,
 *     task_type    TEXT        NOT NULL,
 *     task_label   TEXT        NOT NULL,
 *     tokens_used  INTEGER     NOT NULL DEFAULT 0,
 *     fee_usd      NUMERIC(8,4) NOT NULL DEFAULT 0.0100,
 *     created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
 *   );
 *   CREATE INDEX ON "Transaction_Ledger" (user_id);
 *   CREATE INDEX ON "Transaction_Ledger" (created_at DESC);
 *
 * If SUPABASE_URL / SUPABASE_SERVICE_KEY are not set, the ledger
 * falls back to an in-memory store so local dev works without a DB.
 */

import { randomUUID } from 'crypto';
import type { Response } from 'express';
import type {
  LedgerRow,
  LedgerSummary,
  LedgerUpdateEvent,
} from '@nexus-os/types';

// ── In-Memory Fallback ─────────────────────────────────────────────────────
// Used when Supabase env vars are absent (local dev / CI).

class InMemoryLedger {
  private rows: LedgerRow[] = [];
  private readonly maxRows = 50_000;

  insert(row: Omit<LedgerRow, 'id' | 'created_at'>): LedgerRow {
    const full: LedgerRow = {
      ...row,
      id: randomUUID(),
      created_at: new Date().toISOString(),
    };
    this.rows.push(full);
    if (this.rows.length > this.maxRows) {
      this.rows.splice(0, this.rows.length - this.maxRows);
    }
    return full;
  }

  getByUser(userId: string): LedgerRow[] {
    return this.rows
      .filter((r) => r.user_id === userId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  sumByUser(userId: string): number {
    return this.rows
      .filter((r) => r.user_id === userId)
      .reduce((acc, r) => acc + r.fee_usd, 0);
  }

  tokensByUser(userId: string): number {
    return this.rows
      .filter((r) => r.user_id === userId)
      .reduce((acc, r) => acc + r.tokens_used, 0);
  }
}

// ── Supabase Client (lazy-loaded so missing vars don't crash startup) ───────

type SupabaseClient = {
  from: (table: string) => {
    insert: (data: object) => Promise<{ data: LedgerRow[] | null; error: unknown }>;
    select: (cols?: string) => {
      eq: (col: string, val: string) => Promise<{ data: LedgerRow[] | null; error: unknown }>;
    };
  };
};

let supabase: SupabaseClient | null = null;

async function getSupabase(): Promise<SupabaseClient | null> {
  if (supabase) return supabase;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) return null;

  try {
    const { createClient } = await import('@supabase/supabase-js');
    supabase = createClient(url, key) as unknown as SupabaseClient;
    console.log('[Ledger] ✅ Supabase client initialized.');
    return supabase;
  } catch {
    console.warn('[Ledger] ⚠️  @supabase/supabase-js not installed — using in-memory fallback.');
    return null;
  }
}

// ── Constants ──────────────────────────────────────────────────────────────

const PLATFORM_FEE_USD = 0.01;
const TABLE_NAME       = 'Transaction_Ledger';
const MAX_CUMULATIVE_USERS = 10_000;

interface UserFeeState {
  total: number;
  lastUpdated: number;
}

// ── Ledger Class ───────────────────────────────────────────────────────────

class TransactionLedger {
  private memLedger = new InMemoryLedger();
  /** Running cumulative fee per user for the current process lifetime */
  private cumulativeFees = new Map<string, UserFeeState>();

  private pruneCumulativeFees(): void {
    if (this.cumulativeFees.size <= MAX_CUMULATIVE_USERS) return;

    const oldestUsers = Array.from(this.cumulativeFees.entries())
      .sort((a, b) => a[1].lastUpdated - b[1].lastUpdated)
      .slice(0, this.cumulativeFees.size - MAX_CUMULATIVE_USERS);

    for (const [userId] of oldestUsers) {
      this.cumulativeFees.delete(userId);
    }
  }

  /**
   * Records a $0.01 platform fee for a completed agent task.
   * Writes to Supabase (if configured) and the in-memory fallback.
   * Emits a `ledger_update` SSE event to the active response stream.
   */
  async recordTransaction(
    userId: string,
    agentId: string,
    taskLabel: string,
    taskType: string,
    tokensUsed: number,
    sseRes?: Response,
    isAborted: () => boolean = () => false
  ): Promise<LedgerRow> {
    const rowData = {
      user_id:     userId,
      agent_id:    agentId,
      task_type:   taskType,
      task_label:  taskLabel,
      tokens_used: tokensUsed,
      fee_usd:     PLATFORM_FEE_USD,
    };

    // Optimistically update in-memory record
    const row = this.memLedger.insert(rowData);

    // Update cumulative fee counter
    const prev = this.cumulativeFees.get(userId)?.total ?? this.memLedger.sumByUser(userId) - PLATFORM_FEE_USD;
    const cumulative = Math.round((prev + PLATFORM_FEE_USD) * 10000) / 10000;
    this.cumulativeFees.set(userId, { total: cumulative, lastUpdated: Date.now() });
    this.pruneCumulativeFees();

    console.log(
      `[Ledger] 💰 $${PLATFORM_FEE_USD} — agent: ${agentId} (${taskType}) ` +
      `· ${tokensUsed} tokens · cumulative: $${cumulative.toFixed(4)}`
    );

    const client = await getSupabase();
    if (client) {
      const { error } = await client.from(TABLE_NAME).insert({
        ...rowData,
        id:         row.id,
        created_at: row.created_at,
      });
      if (error) {
        console.error('[Ledger] Supabase write error:', error);
        throw new Error('Failed to persist ledger transaction.');
      }
    }

    if (sseRes && !isAborted()) {
      const event: LedgerUpdateEvent = {
        type:            'ledger_update',
        userId,
        agentId,
        taskLabel,
        taskType,
        tokensUsed,
        feeUsd:          PLATFORM_FEE_USD,
        cumulativeFeeUsd: cumulative,
        createdAt:       row.created_at,
      };
      sseRes.write(`data: ${JSON.stringify(event)}\n\n`);
    }

    if (client) {
      const { data: deducted, error: deductError } = await (client as any).rpc('deduct_user_credits', {
        p_user_id: userId,
        p_amount: PLATFORM_FEE_USD,
      });
      if (deductError) {
        console.error('[Ledger] Credit deduction failed:', deductError);
        // We throw here because in v29+ we must enforce billing
        throw new Error(`Insufficient credits or deduction failed: ${deductError.message}`);
      }
    }

    return row;
  }

  /**
   * Checks if a user has enough balance to run at least one task.
   */
  async hasSufficientBalance(userId: string): Promise<boolean> {
    const client = await getSupabase();
    if (!client) return true; // Fallback for local dev

    const { data: balance, error } = await (client as any).rpc('get_user_credits', {
      p_user_id: userId
    });

    if (error) {
      console.warn('[Ledger] Balance check failed, defaulting to optimistic true:', error);
      return true;
    }

    return (balance || 0) >= PLATFORM_FEE_USD;
  }

  getByUser(userId: string): LedgerRow[] {
    return this.memLedger.getByUser(userId);
  }

  getSummary(userId: string): LedgerSummary {
    const rows = this.memLedger.getByUser(userId);
    return {
      userId,
      totalFeeUsd:      Math.round(this.memLedger.sumByUser(userId) * 10000) / 10000,
      transactionCount: rows.length,
      totalTokensUsed:  this.memLedger.tokensByUser(userId),
      rows,
    };
  }

  /** Returns the running cumulative fee for a user in this session */
  getCumulativeFee(userId: string): number {
    return this.cumulativeFees.get(userId)?.total ?? 0;
  }
}

// Singleton — one ledger instance per process
export const ledger = new TransactionLedger();
