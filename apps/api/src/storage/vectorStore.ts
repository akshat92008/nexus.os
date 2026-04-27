import { withRetry } from '../resilience.js';
import { getEmbedding } from './embeddingProvider.js';
import { getSupabase } from './supabaseClient.js';

export class VectorStore {
  async store(content: string, metadata: Record<string, any> = {}): Promise<void> {
    try {
      const embedding = await getEmbedding(content);
      const client = await getSupabase();
      const { error } = await withRetry(async (_signal) => {
        const result = await client.from('embeddings').insert({
          content,
          embedding,
          metadata,
        });
        if (result.error) throw result.error;
        return result;
      }, 'DB:VectorStore:insert', { retries: 2, timeout: 5000 });
      if (error) throw new Error(`[VectorStore] Store failed: ${error.message}`);
    } catch (err: any) {
      console.error('[VectorStore] 🚨 Critical: Embedding failed. Mission memory is degrading:', err.message || err);
      throw err; // Re-throw to prevent silent failure
    }
  }

  async search(query: string, limit = 5): Promise<Array<{ content: string; similarity: number }>> {
    try {
      const embedding = await getEmbedding(query);
      const client = await getSupabase();
      const { data, error } = await withRetry(async (_signal) => {
        const result = await client.rpc('match_embeddings', {
          query_embedding: embedding,
          match_count: limit,
        });
        if (result.error) throw result.error;
        return result;
      }, 'DB:VectorStore:search', { retries: 2, timeout: 5000 });
      if (error) throw new Error(`[VectorStore] Search failed: ${error.message}`);
      return data ?? [];
    } catch (err: any) {
      console.error('[VectorStore] 🚨 Critical: Search skipped because embedding failed:', err.message || err);
      throw err;
    }
  }

  async storeAgentArtifact(taskId: string, agentType: string, content: string): Promise<void> {
    await this.store(content, { taskId, agentType, type: 'artifact', ts: Date.now() });
  }

  async indexArtifact(artifactId: string, content: string): Promise<void> {
    await this.store(content, { artifactId, type: 'indexed_artifact', ts: Date.now() });
  }
}

export const vectorStore = new VectorStore();
