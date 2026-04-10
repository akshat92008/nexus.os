import { createClient } from '@supabase/supabase-js';
import { logger } from '../logger';
import { LLMRouter } from '../llm/LLMRouter';

// Initialize Supabase client for vector operations
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Generates vector embedding for given text using LLM embeddings endpoint
 * @param text Input text to generate embedding for
 * @returns Numeric vector embedding array
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    logger.debug('Generating embedding for text', { textLength: text.length });
    
    const router = LLMRouter.getInstance();
    const embedding = await router.generateEmbedding(text);
    
    logger.debug('Embedding generated successfully', { dimension: embedding.length });
    return embedding;
  } catch (error) {
    logger.error('Failed to generate embedding', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

/**
 * Stores memory entry with vector embedding in Supabase pgvector table
 * @param userId User identifier
 * @param text Raw memory text content
 * @param embedding Vector embedding array
 */
export async function storeMemory(userId: string, text: string, embedding: number[]) {
  try {
    logger.debug('Storing vector memory', { userId, textLength: text.length });

    const { data, error } = await supabase
      .from('vector_memory')
      .insert({
        user_id: userId,
        content: text,
        embedding: embedding,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    logger.info('Vector memory stored successfully', { memoryId: data.id });
    return data;
  } catch (error) {
    logger.error('Failed to store vector memory', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

/**
 * Semantic search for similar memories using vector similarity
 * @param userId User identifier to scope search
 * @param embedding Query vector embedding
 * @param limit Maximum number of results to return (default: 10)
 * @param similarityThreshold Minimum cosine similarity score (default: 0.7)
 */
export async function searchMemory(
  userId: string, 
  embedding: number[], 
  limit: number = 10, 
  similarityThreshold: number = 0.7
) {
  try {
    logger.debug('Searching vector memory', { userId, limit });

    // Use pgvector cosine similarity search
    const { data, error } = await supabase
      .rpc('match_vector_memories', {
        query_embedding: embedding,
        match_count: limit,
        match_threshold: similarityThreshold,
        user_id_filter: userId
      });

    if (error) throw error;

    logger.info('Vector memory search completed', { resultCount: data?.length || 0 });
    return data || [];
  } catch (error) {
    logger.error('Failed to search vector memory', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}