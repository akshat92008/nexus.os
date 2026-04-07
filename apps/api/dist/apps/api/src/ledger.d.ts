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
import type { Response } from 'express';
import type { LedgerRow, LedgerSummary } from '../../../packages/types/index.js';
declare class TransactionLedger {
    private memLedger;
    /** Running cumulative fee per user for the current process lifetime */
    private cumulativeFees;
    /**
     * Records a $0.01 platform fee for a completed agent task.
     * Writes to Supabase (if configured) and the in-memory fallback.
     * Emits a `ledger_update` SSE event to the active response stream.
     */
    recordTransaction(userId: string, agentId: string, taskLabel: string, taskType: string, tokensUsed: number, sseRes?: Response, isAborted?: () => boolean): Promise<LedgerRow>;
    getByUser(userId: string): LedgerRow[];
    getSummary(userId: string): LedgerSummary;
    /** Returns the running cumulative fee for a user in this session */
    getCumulativeFee(userId: string): number;
}
export declare const ledger: TransactionLedger;
export {};
//# sourceMappingURL=ledger.d.ts.map