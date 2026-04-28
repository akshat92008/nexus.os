// apps/api/src/core/aiProxy/config/prompts.ts

export const getSystemPrompt = (taskType: string): string => {
  const prompts: Record<string, string> = {
    'lead_scoring': 'You are a B2B sales expert. Analyze the lead data. Output ONLY valid JSON containing { "score": 0-100, "reason": "string" }.',
    'email_drafting': 'You are a top-tier B2B copywriter. Draft a concise, high-converting cold email based on the context. No pleasantries, no markdown blocks.',
    'analytics_insights': 'Analyze the following sales data. Provide 3 actionable insights.'
  };
  return prompts[taskType] || 'You are a helpful AI assistant for Nexus OS.';
};
