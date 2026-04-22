import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Test: ledger deduct handles FALSE return ─────────────────────────────────
describe('Ledger — deduct_user_credits FALSE handling', () => {
  it('logs a warning and emits SSE event when deduction returns false', async () => {
    const mockRpc = vi.fn().mockResolvedValue({ data: false, error: null });
    const mockClient = { from: vi.fn().mockReturnThis(), insert: vi.fn().mockResolvedValue({ error: null }), rpc: mockRpc };

    const mockSSE = { write: vi.fn() };
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Import ledger after mocking supabase
    vi.mock('../storage/supabaseClient.js', () => ({ getSupabase: () => mockClient }));
    const { ledger } = await import('../ledger.js');

    await ledger.recordTransaction('user_123', 'agent_1', 'Test Task', 'research', 100, mockSSE as any);

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Insufficient credits'));
    expect(mockSSE.write).toHaveBeenCalledWith(expect.stringContaining('insufficient_credits'));
  });
});

// ── Test: spawn endpoint validates agentType ─────────────────────────────────
describe('POST /api/agents/spawn', () => {
  it('returns 400 for invalid agentType', async () => {
    const { default: app } = await import('../index.js');
    const { default: request } = await import('supertest');

    const res = await request(app)
      .post('/api/agents/spawn')
      .set('Authorization', 'Bearer test-token')
      .send({ agentType: 'hacker' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid input');
  });

  it('returns 200 with valid agentType', async () => {
    const { default: app } = await import('../index.js');
    const { default: request } = await import('supertest');

    const res = await request(app)
      .post('/api/agents/spawn')
      .set('Authorization', 'Bearer test-token')
      .send({ agentType: 'researcher' });

    expect(res.status).toBe(200);
    expect(res.body.agent.type).toBe('researcher');
  });
});
