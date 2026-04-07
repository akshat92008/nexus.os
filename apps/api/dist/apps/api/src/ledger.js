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
// ── In-Memory Fallback ─────────────────────────────────────────────────────
// Used when Supabase env vars are absent (local dev / CI).
class InMemoryLedger {
    rows = [];
    insert(row) {
        const full = {
            ...row,
            id: crypto.randomUUID(),
            created_at: new Date().toISOString(),
        };
        this.rows.push(full);
        return full;
    }
    getByUser(userId) {
        return this.rows
            .filter((r) => r.user_id === userId)
            .sort((a, b) => b.created_at.localeCompare(a.created_at));
    }
    sumByUser(userId) {
        return this.rows
            .filter((r) => r.user_id === userId)
            .reduce((acc, r) => acc + r.fee_usd, 0);
    }
    tokensByUser(userId) {
        return this.rows
            .filter((r) => r.user_id === userId)
            .reduce((acc, r) => acc + r.tokens_used, 0);
    }
}
let supabase = null;
async function getSupabase() {
    if (supabase)
        return supabase;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key)
        return null;
    try {
        const { createClient } = await import('@supabase/supabase-js');
        supabase = createClient(url, key);
        console.log('[Ledger] ✅ Supabase client initialized.');
        return supabase;
    }
    catch {
        console.warn('[Ledger] ⚠️  @supabase/supabase-js not installed — using in-memory fallback.');
        return null;
    }
}
// ── Constants ──────────────────────────────────────────────────────────────
const PLATFORM_FEE_USD = 0.01;
const TABLE_NAME = 'Transaction_Ledger';
// ── Ledger Class ───────────────────────────────────────────────────────────
class TransactionLedger {
    memLedger = new InMemoryLedger();
    /** Running cumulative fee per user for the current process lifetime */
    cumulativeFees = new Map();
    /**
     * Records a $0.01 platform fee for a completed agent task.
     * Writes to Supabase (if configured) and the in-memory fallback.
     * Emits a `ledger_update` SSE event to the active response stream.
     */
    async recordTransaction(userId, agentId, taskLabel, taskType, tokensUsed, sseRes, isAborted = () => false) {
        const rowData = {
            user_id: userId,
            agent_id: agentId,
            task_type: taskType,
            task_label: taskLabel,
            tokens_used: tokensUsed,
            fee_usd: PLATFORM_FEE_USD,
        };
        // Optimistically update in-memory record
        const row = this.memLedger.insert(rowData);
        // Update cumulative fee counter
        const prev = this.cumulativeFees.get(userId) ?? 0;
        const cumulative = Math.round((prev + PLATFORM_FEE_USD) * 10000) / 10000;
        this.cumulativeFees.set(userId, cumulative);
        console.log(`[Ledger] 💰 $${PLATFORM_FEE_USD} — agent: ${agentId} (${taskType}) ` +
            `· ${tokensUsed} tokens · cumulative: $${cumulative.toFixed(4)}`);
        // Fire SSE event immediately (before Supabase write)
        if (sseRes && !isAborted()) {
            const event = {
                type: 'ledger_update',
                userId,
                agentId,
                taskLabel,
                taskType,
                tokensUsed,
                feeUsd: PLATFORM_FEE_USD,
                cumulativeFeeUsd: cumulative,
                createdAt: row.created_at,
            };
            sseRes.write(`data: ${JSON.stringify(event)}\n\n`);
        }
        // Async Supabase write — non-blocking, failure tolerant
        getSupabase().then(async (client) => {
            if (!client)
                return;
            const { error } = await client.from(TABLE_NAME).insert({
                ...rowData,
                id: row.id,
                created_at: row.created_at,
            });
            if (error) {
                console.error('[Ledger] Supabase write error:', error);
            }
        });
        return row;
    }
    getByUser(userId) {
        return this.memLedger.getByUser(userId);
    }
    getSummary(userId) {
        const rows = this.memLedger.getByUser(userId);
        return {
            userId,
            totalFeeUsd: Math.round(this.memLedger.sumByUser(userId) * 10000) / 10000,
            transactionCount: rows.length,
            totalTokensUsed: this.memLedger.tokensByUser(userId),
            rows,
        };
    }
    /** Returns the running cumulative fee for a user in this session */
    getCumulativeFee(userId) {
        return this.cumulativeFees.get(userId) ?? 0;
    }
}
// Singleton — one ledger instance per process
export const ledger = new TransactionLedger();
//# sourceMappingURL=ledger.js.map