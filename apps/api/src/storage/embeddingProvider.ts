import { OpenAI } from 'openai';
import { fetchWithTimeout } from '../resilience.js';

const OPENROUTER_EMBED_URL = 'https://openrouter.ai/api/v1/embeddings';
const EMBEDDING_MODEL = 'text-embedding-3-small';

async function getOpenRouterEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('[EmbeddingProvider] OPENROUTER_API_KEY is not configured.');
  }

  const response = await fetchWithTimeout(
    OPENROUTER_EMBED_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text,
      }),
    },
    10000,
    2,
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`[EmbeddingProvider] OpenRouter embeddings failed (${response.status}): ${errorText}`);
  }

  const data = await response.json() as any;
  const embedding = data.data?.[0]?.embedding ?? data.embedding;
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error('[EmbeddingProvider] OpenRouter returned an empty embedding.');
  }

  return embedding;
}

async function getOpenAIEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('[EmbeddingProvider] OPENAI_API_KEY is not configured.');
  }

  const openai = new OpenAI({ apiKey });
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });

  const embedding = response.data?.[0]?.embedding;
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error('[EmbeddingProvider] OpenAI returned an empty embedding.');
  }

  return embedding;
}

export async function getEmbedding(text: string): Promise<number[]> {
  const normalized = text.trim();
  if (!normalized) {
    throw new Error('[EmbeddingProvider] Cannot embed empty text.');
  }

  if (process.env.OPENROUTER_API_KEY) {
    return getOpenRouterEmbedding(normalized);
  }

  if (process.env.OPENAI_API_KEY) {
    return getOpenAIEmbedding(normalized);
  }

  throw new Error('[SemanticMemory] No embedding provider configured. Set OPENROUTER_API_KEY or OPENAI_API_KEY.');
}
