/**
 * Nexus OS — Semantic Memory System
 * Long-term memory with vector search, inspired by OpenClaw
 * Uses SQLite-vec for local embeddings storage
 */
import { logger } from '../logger.js';
import { getSupabase } from '../storage/supabaseClient.js';
import { randomUUID } from 'crypto';

export type MemoryType = 'conversation' | 'fact' | 'task' | 'preference' | 'document' | 'code' | 'event';
export type MemoryPriority = 'low' | 'medium' | 'high' | 'critical';

export interface MemoryEntry {
  id: string;
  type: MemoryType;
  content: string;
  embedding?: number[];
  metadata: {
    source?: string;
    sessionId?: string;
    missionId?: string;
    workspaceId?: string;
    tags?: string[];
    importance?: MemoryPriority;
    createdBy?: string;
    [key: string]: any;
  };
  createdAt: Date;
  expiresAt?: Date;
  accessCount: number;
  lastAccessedAt?: Date;
  relatedMemoryIds?: string[];
}

export interface MemorySearchOptions {
  query?: string;
  type?: MemoryType | MemoryType[];
  tags?: string[];
  workspaceId?: string;
  sessionId?: string;
  missionId?: string;
  minImportance?: MemoryPriority;
  limit?: number;
  before?: Date;
  after?: Date;
  includeExpired?: boolean;
  similarityThreshold?: number;
}

export interface MemorySearchResult {
  memory: MemoryEntry;
  similarity: number;
  context?: string;
}

export interface MemoryContext {
  memories: MemoryEntry[];
  summary: string;
  relevance: number;
}

class SemanticMemoryManager {
  private initialized: boolean = false;
  private dimension: number = 768; // Default embedding dimension

  async initialize() {
    if (this.initialized) return;
    
    logger.info('[SemanticMemory] Initializing semantic memory system...');
    
    // Initialize Supabase pgvector extension tables
    const supabase = await getSupabase();
    
    // Create memories table with vector support if not exists
    try {
      await supabase.rpc('create_memory_tables_if_not_exists');
    } catch (err) {
      logger.warn('[SemanticMemory] Table creation via RPC failed, may need manual setup');
    }

    this.initialized = true;
    logger.info('[SemanticMemory] Semantic memory system ready');
  }

  async store(entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'accessCount'>): Promise<MemoryEntry> {
    const id = randomUUID();
    const createdAt = new Date();
    
    const memory: MemoryEntry = {
      ...entry,
      id,
      createdAt,
      accessCount: 0
    };

    // Generate embedding if not provided
    if (!memory.embedding && memory.content) {
      try {
        memory.embedding = await this.generateEmbedding(memory.content);
      } catch (err) {
        logger.warn({ err }, '[SemanticMemory] Failed to generate embedding');
      }
    }

    // Store in database
    const supabase = await getSupabase();
    await supabase.from('semantic_memories').insert({
      id: memory.id,
      type: memory.type,
      content: memory.content,
      embedding: memory.embedding,
      metadata: memory.metadata,
      created_at: memory.createdAt.toISOString(),
      expires_at: memory.expiresAt?.toISOString(),
      access_count: memory.accessCount,
      related_memory_ids: memory.relatedMemoryIds
    });

    logger.info(`[SemanticMemory] Stored memory: ${id} (${memory.type})`);
    
    return memory;
  }

  async search(options: MemorySearchOptions): Promise<MemorySearchResult[]> {
    const supabase = await getSupabase();
    
    let query = supabase
      .from('semantic_memories')
      .select('*');

    // Apply filters
    if (options.type) {
      if (Array.isArray(options.type)) {
        query = query.in('type', options.type);
      } else {
        query = query.eq('type', options.type);
      }
    }

    if (options.tags && options.tags.length > 0) {
      query = query.contains('metadata->tags', options.tags);
    }

    if (options.workspaceId) {
      query = query.eq('metadata->workspaceId', options.workspaceId);
    }

    if (options.sessionId) {
      query = query.eq('metadata->sessionId', options.sessionId);
    }

    if (options.missionId) {
      query = query.eq('metadata->missionId', options.missionId);
    }

    if (options.before) {
      query = query.lte('created_at', options.before.toISOString());
    }

    if (options.after) {
      query = query.gte('created_at', options.after.toISOString());
    }

    if (!options.includeExpired) {
      query = query.or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
    }

    // Semantic search with query
    let results: any[] = [];

    if (options.query && options.query.trim()) {
      const embedding = await this.generateEmbedding(options.query);
      
      // Use pgvector similarity search
      const { data, error } = await supabase.rpc('search_memories', {
        query_embedding: embedding,
        match_threshold: options.similarityThreshold || 0.7,
        match_count: options.limit || 10,
        filter_type: options.type as string || null,
        filter_workspace_id: options.workspaceId || null
      });

      if (error) {
        logger.error({ err: error }, '[SemanticMemory] Semantic search failed');
        // Fall back to text search
        const { data: fallbackData } = await query
          .textSearch('content', options.query)
          .limit(options.limit || 10);
        results = fallbackData || [];
      } else {
        results = data || [];
      }
    } else {
      // Non-semantic search
      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(options.limit || 50);

      if (error) {
        logger.error({ err: error }, '[SemanticMemory] Search failed');
        return [];
      }

      results = data || [];
    }

    // Update access counts
    for (const result of results) {
      await supabase
        .from('semantic_memories')
        .update({
          access_count: (result.access_count || 0) + 1,
          last_accessed_at: new Date().toISOString()
        })
        .eq('id', result.id);
    }

    return results.map(r => ({
      memory: this.deserialize(r),
      similarity: r.similarity || 1.0
    }));
  }

  async recall(query: string, context?: {
    sessionId?: string;
    missionId?: string;
    workspaceId?: string;
    limit?: number;
  }): Promise<MemoryContext> {
    const results = await this.search({
      query,
      limit: context?.limit || 10,
      sessionId: context?.sessionId,
      missionId: context?.missionId,
      workspaceId: context?.workspaceId
    });

    if (results.length === 0) {
      return {
        memories: [],
        summary: 'No relevant memories found.',
        relevance: 0
      };
    }

    const memories = results.map(r => r.memory);
    const avgSimilarity = results.reduce((sum, r) => sum + r.similarity, 0) / results.length;

    // Generate contextual summary
    const summary = await this.summarizeMemories(memories, query);

    return {
      memories,
      summary,
      relevance: avgSimilarity
    };
  }

  async getRelatedMemories(memoryId: string, limit: number = 5): Promise<MemoryEntry[]> {
    const supabase = await getSupabase();
    
    // Get the memory first
    const { data: memory } = await supabase
      .from('semantic_memories')
      .select('*')
      .eq('id', memoryId)
      .single();

    if (!memory || !memory.embedding) return [];

    // Find similar memories
    const { data: similar } = await supabase.rpc('search_memories', {
      query_embedding: memory.embedding,
      match_threshold: 0.6,
      match_count: limit + 1,
      filter_type: null,
      filter_workspace_id: memory.metadata?.workspaceId || null
    });

    if (!similar) return [];

    // Filter out the memory itself
    return similar
      .filter((r: any) => r.id !== memoryId)
      .slice(0, limit)
      .map((r: any) => this.deserialize(r));
  }

  async update(memoryId: string, updates: Partial<MemoryEntry>): Promise<MemoryEntry | null> {
    const supabase = await getSupabase();
    
    const updateData: any = {};
    if (updates.content) updateData.content = updates.content;
    if (updates.metadata) updateData.metadata = updates.metadata;
    if (updates.relatedMemoryIds) updateData.related_memory_ids = updates.relatedMemoryIds;

    const { data, error } = await supabase
      .from('semantic_memories')
      .update(updateData)
      .eq('id', memoryId)
      .select()
      .single();

    if (error || !data) return null;

    return this.deserialize(data);
  }

  async delete(memoryId: string): Promise<boolean> {
    const supabase = await getSupabase();
    const { error } = await supabase
      .from('semantic_memories')
      .delete()
      .eq('id', memoryId);

    return !error;
  }

  async compact(options?: {
    before?: Date;
    types?: MemoryType[];
    minAccessCount?: number;
    preserveHighImportance?: boolean;
  }): Promise<{ deleted: number; summarized: number }> {
    const supabase = await getSupabase();
    
    let query = supabase
      .from('semantic_memories')
      .select('*');

    if (options?.before) {
      query = query.lt('created_at', options.before.toISOString());
    }

    if (options?.types) {
      query = query.in('type', options.types);
    }

    const { data: oldMemories } = await query;

    if (!oldMemories || oldMemories.length === 0) {
      return { deleted: 0, summarized: 0 };
    }

    let deleted = 0;
    let summarized = 0;

    // Group memories by session/mission
    const groups = this.groupMemories(oldMemories);

    for (const [groupId, memories] of groups) {
      if (memories.length < 5) {
        // Too few to summarize, keep them
        continue;
      }

      // Check if any are high importance
      const hasHighImportance = memories.some(m => 
        m.metadata?.importance === 'high' || m.metadata?.importance === 'critical'
      );

      if (options?.preserveHighImportance && hasHighImportance) {
        // Summarize low/medium importance memories only
        const toSummarize = memories.filter(m => 
          !['high', 'critical'].includes(m.metadata?.importance)
        );
        
        if (toSummarize.length >= 5) {
          await this.summarizeAndReplace(toSummarize);
          summarized += toSummarize.length;
        }
      } else {
        // Summarize all in group
        await this.summarizeAndReplace(memories);
        summarized += memories.length;
      }
    }

    logger.info(`[SemanticMemory] Compacted memories: ${summarized} summarized, ${deleted} deleted`);
    
    return { deleted, summarized };
  }

  async storeConversationTurn(
    sessionId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: Record<string, any>
  ): Promise<MemoryEntry> {
    return this.store({
      type: 'conversation',
      content: `${role}: ${content}`,
      metadata: {
        sessionId,
        source: 'conversation',
        ...metadata
      }
    });
  }

  async storeFact(
    content: string,
    importance: MemoryPriority = 'medium',
    metadata?: Record<string, any>
  ): Promise<MemoryEntry> {
    return this.store({
      type: 'fact',
      content,
      metadata: {
        importance,
        ...metadata
      }
    });
  }

  async storePreference(
    category: string,
    value: string,
    metadata?: Record<string, any>
  ): Promise<MemoryEntry> {
    return this.store({
      type: 'preference',
      content: `${category}: ${value}`,
      metadata: {
        category,
        ...metadata
      }
    });
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    // Use OpenAI or local embedding model
    try {
      const { OpenAI } = await import('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
        dimensions: this.dimension
      });

      return response.data[0].embedding;
    } catch (err) {
      // Fallback: use simple hash-based embedding (not semantic but preserves some structure)
      return this.fallbackEmbedding(text);
    }
  }

  private fallbackEmbedding(text: string): number[] {
    // Simple bag-of-words style embedding for fallback
    const words = text.toLowerCase().split(/\s+/);
    const embedding = new Array(this.dimension).fill(0);
    
    for (let i = 0; i < words.length; i++) {
      const hash = this.hashString(words[i]);
      for (let j = 0; j < this.dimension; j++) {
        embedding[j] += Math.sin(hash * (j + 1)) / words.length;
      }
    }
    
    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    return embedding.map(v => v / (magnitude || 1));
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private async summarizeMemories(memories: MemoryEntry[], query?: string): Promise<string> {
    const { llmRouter } = await import('../llm/LLMRouter.js');
    
    const content = memories.map(m => `- [${m.type}] ${m.content}`).join('\n');
    
    const prompt = query
      ? `Summarize the following memories in relation to the query "${query}":\n\n${content}`
      : `Summarize the following memories concisely:\n\n${content}`;

    try {
      const response = await llmRouter.routeRequest({
        model: 'llama-3.3-70b',
        messages: [
          { role: 'system', content: 'Summarize memories concisely, preserving key facts.' },
          { role: 'user', content: prompt }
        ]
      });

      return response.content || 'Memories recalled';
    } catch (err) {
      return `Recalled ${memories.length} memories.`;
    }
  }

  private groupMemories(memories: any[]): Map<string, any[]> {
    const groups = new Map<string, any[]>();
    
    for (const memory of memories) {
      const groupId = memory.metadata?.sessionId || 
                     memory.metadata?.missionId || 
                     memory.metadata?.workspaceId || 
                     'default';
      
      if (!groups.has(groupId)) {
        groups.set(groupId, []);
      }
      groups.get(groupId)!.push(memory);
    }
    
    return groups;
  }

  private async summarizeAndReplace(memories: any[]) {
    const content = memories.map(m => m.content).join('\n\n');
    const summary = await this.summarizeMemories(memories.map(m => this.deserialize(m)));
    
    // Delete old memories
    const supabase = await getSupabase();
    await supabase
      .from('semantic_memories')
      .delete()
      .in('id', memories.map(m => m.id));

    // Store summary
    const first = memories[0];
    await this.store({
      type: first.type,
      content: `[SUMMARY] ${summary}`,
      metadata: {
        ...first.metadata,
        isSummary: true,
        originalCount: memories.length,
        originalIds: memories.map(m => m.id)
      }
    });
  }

  private deserialize(data: any): MemoryEntry {
    return {
      id: data.id,
      type: data.type,
      content: data.content,
      embedding: data.embedding,
      metadata: data.metadata || {},
      createdAt: new Date(data.created_at),
      expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
      accessCount: data.access_count || 0,
      lastAccessedAt: data.last_accessed_at ? new Date(data.last_accessed_at) : undefined,
      relatedMemoryIds: data.related_memory_ids
    };
  }
}

export const semanticMemory = new SemanticMemoryManager();
