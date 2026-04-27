/**
 * Nexus OS — Canvas / Live Document System
 * Real-time collaborative documents with AI rendering, inspired by OpenClaw canvas-host
 */
import { logger } from '../logger.js';
import { eventBus } from '../events/eventBus.js';
import { getSupabase } from '../storage/supabaseClient.js';
import { randomUUID } from 'crypto';

export interface CanvasDocument {
  id: string;
  title: string;
  type: 'whiteboard' | 'code' | 'markdown' | 'diagram' | 'spreadsheet' | 'mixed';
  content: CanvasBlock[];
  participants: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  metadata: {
    language?: string;
    theme?: string;
    width?: number;
    height?: number;
    zoom?: number;
  };
}

export interface CanvasBlock {
  id: string;
  type: 'text' | 'code' | 'image' | 'shape' | 'connector' | 'embed' | 'table' | 'chart' | 'ai-generated';
  x: number;
  y: number;
  width: number;
  height: number;
  content: any;
  style?: Record<string, any>;
  editable: boolean;
  author?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CanvasOperation {
  type: 'insert' | 'update' | 'delete' | 'move' | 'resize' | 'style';
  blockId?: string;
  data?: any;
  timestamp: Date;
  author: string;
}

class CanvasManager {
  private documents: Map<string, CanvasDocument> = new Map();
  private operations: Map<string, CanvasOperation[]> = new Map();
  private subscribers: Map<string, Set<(doc: CanvasDocument) => void>> = new Map();

  async initialize() {
    logger.info('[CanvasManager] Initializing canvas system...');
    await this.loadDocuments();
    logger.info(`[CanvasManager] Loaded ${this.documents.size} documents`);
  }

  async loadDocuments() {
    const supabase = await getSupabase();
    const { data } = await supabase.from('canvas_documents').select('*').order('updated_at', { ascending: false });
    
    for (const doc of data || []) {
      this.documents.set(doc.id, this.deserialize(doc));
    }
  }

  async createDocument(params: {
    title: string;
    type: CanvasDocument['type'];
    createdBy: string;
    blocks?: Partial<CanvasBlock>[];
    metadata?: CanvasDocument['metadata'];
  }): Promise<CanvasDocument> {
    const id = randomUUID();
    const now = new Date();

    const blocks: CanvasBlock[] = (params.blocks || []).map((b, i) => ({
      id: b.id || randomUUID(),
      type: b.type || 'text',
      x: b.x ?? 100 + (i * 20),
      y: b.y ?? 100 + (i * 20),
      width: b.width ?? 400,
      height: b.height ?? 200,
      content: b.content || '',
      style: b.style || {},
      editable: true,
      author: params.createdBy,
      createdAt: now,
      updatedAt: now
    }));

    const doc: CanvasDocument = {
      id,
      title: params.title,
      type: params.type,
      content: blocks,
      participants: [params.createdBy],
      createdBy: params.createdBy,
      createdAt: now,
      updatedAt: now,
      version: 1,
      metadata: params.metadata || {}
    };

    this.documents.set(id, doc);
    this.operations.set(id, []);
    this.subscribers.set(id, new Set());

    await this.persist(doc);
    
    logger.info(`[CanvasManager] Created document: ${id} (${params.type})`);
    return doc;
  }

  async applyOperation(documentId: string, operation: CanvasOperation): Promise<CanvasDocument> {
    const doc = this.documents.get(documentId);
    if (!doc) throw new Error(`Document ${documentId} not found`);

    const ops = this.operations.get(documentId) || [];
    ops.push(operation);
    this.operations.set(documentId, ops);

    // Apply operation
    switch (operation.type) {
      case 'insert':
        doc.content.push(operation.data);
        break;
      case 'update': {
        const idx = doc.content.findIndex(b => b.id === operation.blockId);
        if (idx !== -1) {
          doc.content[idx] = { ...doc.content[idx], ...operation.data, updatedAt: new Date() };
        }
        break;
      }
      case 'delete': {
        doc.content = doc.content.filter(b => b.id !== operation.blockId);
        break;
      }
      case 'move': {
        const block = doc.content.find(b => b.id === operation.blockId);
        if (block) {
          block.x = operation.data.x;
          block.y = operation.data.y;
          block.updatedAt = new Date();
        }
        break;
      }
      case 'resize': {
        const rblock = doc.content.find(b => b.id === operation.blockId);
        if (rblock) {
          rblock.width = operation.data.width;
          rblock.height = operation.data.height;
          rblock.updatedAt = new Date();
        }
        break;
      }
      case 'style': {
        const sblock = doc.content.find(b => b.id === operation.blockId);
        if (sblock) {
          sblock.style = { ...sblock.style, ...operation.data };
          sblock.updatedAt = new Date();
        }
        break;
      }
    }

    doc.version++;
    doc.updatedAt = new Date();

    await this.persist(doc);
    this.broadcast(documentId, doc);

    return doc;
  }

  async aiGenerateBlock(documentId: string, prompt: string, author: string): Promise<CanvasBlock> {
    const { llmRouter } = await import('../llm/LLMRouter.js');
    
    const response = await llmRouter.call({
      system: 'You are a document generation assistant. Generate content based on the user prompt. Respond with a JSON object: { "type": "text|code|table|chart", "content": "...", "style": {} }',
      user: prompt,
      model: 'llama-3.3-70b',
      maxTokens: 1200,
      temperature: 0.4
    });

    let generated: any = {};
    try {
      const match = response.content?.match(/\{[\s\S]*\}/);
      if (match) generated = JSON.parse(match[0]);
    } catch {
      generated = { type: 'text', content: response.content || prompt, style: {} };
    }

    const block: CanvasBlock = {
      id: randomUUID(),
      type: generated.type || 'text',
      x: 100,
      y: 100,
      width: 600,
      height: 400,
      content: generated.content || generated,
      style: generated.style || {},
      editable: true,
      author,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await this.applyOperation(documentId, {
      type: 'insert',
      data: block,
      timestamp: new Date(),
      author
    });

    return block;
  }

  async renderToHtml(documentId: string): Promise<string> {
    const doc = this.documents.get(documentId);
    if (!doc) throw new Error('Document not found');

    const blocks = doc.content.map(b => {
      switch (b.type) {
        case 'code':
          return `<pre style="position:absolute;left:${b.x}px;top:${b.y}px;width:${b.width}px;"><code>${b.content}</code></pre>`;
        case 'image':
          return `<img src="${b.content}" style="position:absolute;left:${b.x}px;top:${b.y}px;width:${b.width}px;height:${b.height}px;" />`;
        case 'text':
        default:
          return `<div style="position:absolute;left:${b.x}px;top:${b.y}px;width:${b.width}px;">${b.content}</div>`;
      }
    }).join('\n');

    return `<!DOCTYPE html><html><head><title>${doc.title}</title><style>body{position:relative;width:1200px;height:800px;}</style></head><body>${blocks}</body></html>`;
  }

  getDocument(id: string): CanvasDocument | undefined {
    return this.documents.get(id);
  }

  getDocuments(): CanvasDocument[] {
    return Array.from(this.documents.values());
  }

  subscribe(documentId: string, callback: (doc: CanvasDocument) => void): () => void {
    const subs = this.subscribers.get(documentId) || new Set();
    subs.add(callback);
    this.subscribers.set(documentId, subs);
    return () => subs.delete(callback);
  }

  private broadcast(documentId: string, doc: CanvasDocument) {
    const subs = this.subscribers.get(documentId);
    if (subs) {
      for (const cb of subs) {
        try { cb(doc); } catch (err) { logger.warn({ err }, 'Canvas subscriber error'); }
      }
    }
    eventBus.publish(`canvas:${documentId}`, { type: 'canvas_update', document: doc }).catch(() => {});
  }

  private async persist(doc: CanvasDocument) {
    const supabase = await getSupabase();
    await supabase.from('canvas_documents').upsert({
      id: doc.id,
      title: doc.title,
      type: doc.type,
      content: doc.content,
      participants: doc.participants,
      created_by: doc.createdBy,
      created_at: doc.createdAt.toISOString(),
      updated_at: doc.updatedAt.toISOString(),
      version: doc.version,
      metadata: doc.metadata
    });
  }

  private deserialize(data: any): CanvasDocument {
    return {
      ...data,
      content: data.content || [],
      participants: data.participants || [],
      metadata: data.metadata || {},
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }
}

export const canvasManager = new CanvasManager();
