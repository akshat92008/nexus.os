/**
 * Nexus OS — Vector Store (Semantic Recall)
 *
 * Handles embedding generation and similarity search using PgVector.
 * Provides long-term memory for agents.
 */

import OpenAI from 'openai';
import { nexusStateStore } from './nexusStateStore.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

class VectorStore {
  private readonly EMBEDDING_MODEL = 'text-embedding-3-small';

  /**
   * Generates an embedding for a given text.
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await openai.embeddings.create({
        model: this.EMBEDDING_MODEL,
        input: text.slice(0, 8000), // OpenAI limit
      });
      return response.data[0].embedding;
    } catch (err) {
      console.error('[VectorStore] ❌ Embedding generation failed:', err);
      throw err;
    }
  }

  /**
   * Updates an artifact with its semantic embedding.
   */
  async indexArtifact(artifactId: string, content: string) {
    const embedding = await this.generateEmbedding(content);
    const { error } = await (await nexusStateStore.getSupabaseClient())
      .from('artifacts')
      .update({ embedding })
      .eq('id', artifactId);

    if (error) throw new Error(`[VectorStore] Failed to index artifact: ${error.message}`);
    console.log(`[VectorStore] 🧠 Indexed artifact ${artifactId} for semantic recall.`);
  }

  /**
   * Performs semantic similarity search across artifacts.
   */
  async searchSimilar(query: string, options: { missionId?: string; threshold?: number; limit?: number } = {}) {
    const embedding = await this.generateEmbedding(query);
    const { data, error } = await (await nexusStateStore.getSupabaseClient()).rpc('match_artifacts', {
      query_embedding: embedding,
      match_threshold: options.threshold ?? 0.5,
      match_count: options.limit ?? 5,
      filter_mission_id: options.missionId,
    });

    if (error) throw new Error(`[VectorStore] Search failed: ${error.message}`);
    return data;
  }
}

export const vectorStore = new VectorStore();
