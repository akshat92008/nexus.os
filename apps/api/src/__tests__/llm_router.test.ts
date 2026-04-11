import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LLMRouter, MODEL_FAST } from '../llm/LLMRouter.js';
import { rateLimitMonitor } from '../llm/RateLimitMonitor.js';

// Mock Providers
vi.mock('../llm/OpenRouterProvider.js', () => ({
  OpenRouterProvider: class {
    call = vi.fn().mockResolvedValue({ content: 'OpenRouter OK', tokens: 10 });
  }
}));

vi.mock('../llm/GroqProvider.js', () => ({
  GroqProvider: class {
    call = vi.fn().mockResolvedValue({ content: 'Groq OK', tokens: 5 });
  }
}));

describe('LLMRouter', () => {
  let router: LLMRouter;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.GROQ_API_KEY = 'test-key';
    router = new LLMRouter();
  });

  it('rotates through models on failure', async () => {
    const openRouter = (router as any).openRouter;
    openRouter.call
      .mockRejectedValueOnce(new Error('429 Rate Limit'))
      .mockResolvedValueOnce({ content: 'Second Model OK', tokens: 12 });

    const response = await router.call({
      model: MODEL_FAST,
      system: 'sys',
      user: 'hello',
    });

    expect(response.content).toBe('Second Model OK');
    expect(openRouter.call).toHaveBeenCalledTimes(2);
  });

  it('falls back to Groq when OpenRouter is exhausted', async () => {
    const openRouter = (router as any).openRouter;
    const groq = (router as any).groqFallback;

    openRouter.call.mockRejectedValue(new Error('OpenRouter Down'));
    
    // We also need to mock Gemini since it's in the flow
    (router as any).gemini = { call: vi.fn().mockRejectedValue(new Error('Gemini Down')) };

    const response = await router.call({
      model: MODEL_FAST,
      system: 'sys',
      user: 'hello',
    });

    expect(response.content).toBe('Groq OK');
    expect(groq.call).toHaveBeenCalled();
  });

  it('compresses large context before calling LLM', async () => {
    const callSpy = vi.spyOn(router, 'call');
    const largeUserContent = 'A'.repeat(30000);

    // Mock first call for summary, second for actual response
    (router as any).openRouter.call
      .mockResolvedValueOnce({ content: 'Summary OK', tokens: 5 })
      .mockResolvedValueOnce({ content: 'Final OK', tokens: 10 });

    const response = await router.call({
      model: MODEL_FAST,
      system: 'sys',
      user: largeUserContent,
    });

    expect(response.content).toBe('Final OK');
    // Once for summary, once for the actual (refined) request
    expect(callSpy).toHaveBeenCalledTimes(2);
  });
});
