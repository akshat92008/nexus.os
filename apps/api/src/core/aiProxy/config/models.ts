// apps/api/src/core/aiProxy/config/models.ts

// Pricing per 1M tokens in USD
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'groq:llama3-8b-8192': { input: 0.05, output: 0.08 }, // Extremely cheap, fast
  'groq:llama3-70b-8192': { input: 0.59, output: 0.79 },
  'gemini:gemini-1.5-flash': { input: 0.075, output: 0.30 }, // Great fallback
  'openrouter:gpt-4o-mini': { input: 0.15, output: 0.60 },
  'openrouter:claude-3.5-sonnet': { input: 3.00, output: 15.00 }, // High tier
  'nvidia:deepseek-ai/deepseek-v4-pro': { input: 0.14, output: 0.14 }, // Very competitive pricing
};

// Routing definition
export const TASK_ROUTING: Record<string, { primary: string; fallbacks: string[]; defaultMaxTokens: number }> = {
  'lead_scoring': {
    primary: 'groq:llama3-8b-8192',
    fallbacks:['gemini:gemini-1.5-flash', 'openrouter:gpt-4o-mini'],
    defaultMaxTokens: 200,
  },
  'email_drafting': {
    // Groq is primary: fast, cheap, high quality for email tasks
    primary: 'groq:llama3-70b-8192',
    fallbacks:['openrouter:gpt-4o-mini', 'gemini:gemini-1.5-flash'],
    defaultMaxTokens: 800,
  },
  'analytics_insights': {
    // Use Nvidia DeepSeek as primary, Groq as fallback
    primary: 'nvidia:deepseek-ai/deepseek-v4-pro',
    fallbacks:['groq:llama3-70b-8192', 'openrouter:gpt-4o-mini', 'gemini:gemini-1.5-flash'],
    defaultMaxTokens: 4096,
  }
};
