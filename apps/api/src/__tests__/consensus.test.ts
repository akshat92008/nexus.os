import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runConsensus } from '../../consensus/consensus.js';
import { LLMRouter } from '../llm/LLMRouter.js';

// Mock LLMRouter
vi.mock('../llm/LLMRouter.js', () => {
  return {
    LLMRouter: vi.fn().mockImplementation(() => {
      return {
        call: vi.fn().mockResolvedValue({ content: 'Mocked Response', tokens: 10 })
      };
    }),
    MODEL_POWER: 'MODEL_POWER'
  };
});

describe('runConsensus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses default token limit of 1500 when config is undefined', async () => {
    await runConsensus('test prompt');
    const mockedLLMRouter = vi.mocked(LLMRouter);
    // Find the instance that has call.mock.calls.length > 0
    const routerInstance = mockedLLMRouter.mock.results.find(res => res.value.call.mock.calls.length > 0)?.value;

    // Check first call (Draft A)
    expect(routerInstance.call).toHaveBeenCalledWith(expect.objectContaining({
      maxTokens: 1500
    }));
  });

  it('uses default token limit of 1500 when config.token.limit is not a number', async () => {
    await runConsensus('test prompt', '', { token: { limit: 'invalid' } });
    const mockedLLMRouter = vi.mocked(LLMRouter);
    const routerInstance = mockedLLMRouter.mock.results.find(res => res.value.call.mock.calls.length > 0)?.value;

    expect(routerInstance.call).toHaveBeenCalledWith(expect.objectContaining({
      maxTokens: 1500
    }));
  });

  it('uses default token limit of 1500 when config.token.limit is zero', async () => {
    await runConsensus('test prompt', '', { token: { limit: 0 } });
    const mockedLLMRouter = vi.mocked(LLMRouter);
    const routerInstance = mockedLLMRouter.mock.results.find(res => res.value.call.mock.calls.length > 0)?.value;

    expect(routerInstance.call).toHaveBeenCalledWith(expect.objectContaining({
      maxTokens: 1500
    }));
  });

  it('uses default token limit of 1500 when config.token.limit is negative', async () => {
    await runConsensus('test prompt', '', { token: { limit: -100 } });
    const mockedLLMRouter = vi.mocked(LLMRouter);
    const routerInstance = mockedLLMRouter.mock.results.find(res => res.value.call.mock.calls.length > 0)?.value;

    expect(routerInstance.call).toHaveBeenCalledWith(expect.objectContaining({
      maxTokens: 1500
    }));
  });

  it('uses provided token limit when it is a positive number', async () => {
    await runConsensus('test prompt', '', { token: { limit: 2500 } });
    const mockedLLMRouter = vi.mocked(LLMRouter);
    const routerInstance = mockedLLMRouter.mock.results.find(res => res.value.call.mock.calls.length > 0)?.value;

    expect(routerInstance.call).toHaveBeenCalledWith(expect.objectContaining({
      maxTokens: 2500
    }));
  });
});
