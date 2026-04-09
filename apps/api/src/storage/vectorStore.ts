import { getSupabase } from './supabaseClient.js';

const EMBED_URL = 'https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent';

async function getEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set — free at aistudio.google.com');

  const res = await fetch(`${EMBED_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'models/text-embedding-004',
      content: { parts: [{ text }] },
    }),
  });

  if (!res.ok) throw new Error(`[VectorStore] Embed failed: ${res.status}`);
  const data = await res.json() as any;
  return data.embedding.values as number[];
}

export class VectorStore {
  async store(content: string, metadata: Record<string, any> = {}): Promise<void> {
    const embedding = await getEmbedding(content);
    const client = await getSupabase();
    const { error } = await client.from('embeddings').insert({
      content,
      embedding: embedding, // Supabase handles array to vector conversion if the column is type vector
      metadata,
    });
    if (error) throw new Error(`[VectorStore] Store failed: ${error.message}`);
  }

  async search(query: string, limit = 5): Promise<Array<{ content: string; similarity: number }>> {
    const embedding = await getEmbedding(query);
    const client = await getSupabase();
    const { data, error } = await client.rpc('match_embeddings', {
      query_embedding: embedding,
      match_count: limit,
    });
    if (error) throw new Error(`[VectorStore] Search failed: ${error.message}`);
    return data ?? [];
  }

  async storeAgentArtifact(taskId: string, agentType: string, content: string): Promise<void> {
    await this.store(content, { taskId, agentType, type: 'artifact', ts: Date.now() });
  }
}

export const vectorStore = new VectorStore();
