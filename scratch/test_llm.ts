
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../apps/api/.env') });

import { llmRouter, MODEL_FAST } from '../apps/api/src/llm/LLMRouter.js';
import { logger } from '../apps/api/src/logger.js';

async function testLLM() {
  console.log('Testing LLM Router Connectivity...');
  console.log('GROQ_API_KEY present:', !!process.env.GROQ_API_KEY);
  console.log('OPENROUTER_API_KEY present:', !!process.env.OPENROUTER_API_KEY);

  try {
    const response = await llmRouter.call({
      system: 'You are a health check bot. Respond only with "NEXUS_OK"',
      user: 'Hello',
      model: MODEL_FAST,
      maxTokens: 10
    });
    console.log('SUCCESS:', response.content);
  } catch (err: any) {
    console.error('FAILED:', err.message);
    if (err.message.includes('Breaker is open')) {
      console.log('HINT: The circuit breaker is tripped. Wait 30s or restart the server.');
    }
  }
}

testLLM();
