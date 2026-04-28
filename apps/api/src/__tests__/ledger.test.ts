import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ledger } from '../ledger.js';

// Mock Supabase Client
const mockInsert = vi.fn();
const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  insert: mockInsert,
};

vi.mock('../storage/supabaseClient.js', () => ({
  getSupabase: async () => mockSupabase,
}));

describe('Transaction Ledger', () => {
  const userId = 'user-123';
  const agentId = 'agent-456';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('records a transaction and updates cumulative fees', async () => {
    mockInsert.mockResolvedValue({ data: [], error: null });

    const row = await ledger.recordTransaction(userId, agentId, 'Test Task', 'researcher', 100);

    expect(row.user_id).toBe(userId);
    expect(row.agent_id).toBe(agentId);
    expect(row.fee_usd).toBe(0.01);
    expect(ledger.getCumulativeFee(userId)).toBe(0.01);
  });

  it('returns true for sufficient balance (Nexus OS Free Tier)', async () => {
    const hasBalance = await ledger.hasSufficientBalance(userId);
    expect(hasBalance).toBe(true);
  });

  it('calculates summary correctly', async () => {
    mockInsert.mockResolvedValue({ data: [], error: null });
    
    // Record another one
    await ledger.recordTransaction(userId, agentId, 'Task 2', 'analyst', 50);
    
    const summary = ledger.getSummary(userId);
    expect(summary.transactionCount).toBeGreaterThanOrEqual(2);
    expect(summary.totalFeeUsd).toBeCloseTo(ledger.getCumulativeFee(userId), 4);
    expect(summary.totalTokensUsed).toBeGreaterThanOrEqual(150);
  });
});
