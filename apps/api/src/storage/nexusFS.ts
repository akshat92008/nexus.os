/**
 * NexusOS — Smart File System (NexusFS)
 * 
 * A virtualized, AI-powered file system with automatic categorization,
 * versioning, and unified data access.
 */

import type { NexusFile, NexusFolder, FileCategory } from '@nexus-os/types';
import { getSupabase } from './supabaseClient.js';

class NexusFS {
  private files: Map<string, NexusFile> = new Map();
  private folders: Map<string, NexusFolder> = new Map();
  private loadedUsers: Set<string> = new Set();

  constructor() {
    // Initialize root folder
    void this.createFolder('root', 'Root', null, 'system');
    
    // Seed with some initial folders
    void this.createFolder('f_docs', 'Documents', 'root', 'system');
    void this.createFolder('f_media', 'Media', 'root', 'system');
    void this.createFolder('f_code', 'Projects', 'root', 'system');
    void this.createFolder('f_arch', 'Archives', 'root', 'system');
  }

  public async createFolder(id: string, name: string, parentId: string | null, ownerId: string): Promise<NexusFolder> {
    const path = parentId ? `${this.folders.get(parentId)?.path || ''}/${name}` : `/${name}`;
    const folder: NexusFolder = {
      id,
      name,
      path,
      parentId,
      ownerId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.folders.set(id, folder);

    try {
      const supabase = await getSupabase(); 
      await supabase.from('nexus_folders').upsert({ 
        id: folder.id, name: folder.name, path: folder.path, 
        parent_id: folder.parentId, owner_id: folder.ownerId, 
      }); 
    } catch (err) {
      console.warn('[NexusFS] createFolder persistence failed:', err);
    }

    return folder;
  }

  public async uploadFile(
    name: string, 
    content: string, 
    parentId: string, 
    ownerId: string,
    mimeType: string
  ): Promise<NexusFile> {
    const id = `file_${crypto.randomUUID()}`;
    const extension = name.split('.').pop() || '';
    const category = this.detectCategory(extension, mimeType);
    
    const file: NexusFile = {
      id,
      name,
      extension,
      size: content.length,
      mimeType,
      path: `${this.folders.get(parentId)?.path || ''}/${name}`,
      parentId,
      ownerId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: {
        category,
        tags: [],
        isEncrypted: false,
        version: 1,
        lastAccessedAt: Date.now(),
      },
    };

    // AI Tagging (Simulated)
    file.metadata.tags = await this.generateAITags(name, content);
    file.metadata.aiSummary = await this.generateAISummary(name, content);

    this.files.set(id, file);

    try {
      const supabase = await getSupabase(); 
      const storagePath = `${ownerId}/${id}/${name}`; 
      const { error: uploadError } = await supabase.storage.from('nexus-files').upload(storagePath, content, { contentType: mimeType }); 
      if (uploadError) throw uploadError;

      await supabase.from('nexus_files').insert({ 
        id, name, extension, size: content.length, mime_type: mimeType, 
        path: file.path, parent_id: parentId, owner_id: ownerId, 
        storage_path: storagePath, metadata: file.metadata, 
      }); 
    } catch (err) {
      console.warn('[NexusFS] uploadFile persistence failed:', err);
    }

    return file;
  }

  public async loadUserFiles(ownerId: string): Promise<void> {
    if (this.loadedUsers.has(ownerId)) return;

    try {
      const supabase = await getSupabase();
      const { data: folders, error: foldersError } = await supabase.from('nexus_folders').select('*').eq('owner_id', ownerId);
      if (foldersError) throw foldersError;
      
      const { data: files, error: filesError } = await supabase.from('nexus_files').select('*').eq('owner_id', ownerId);
      if (filesError) throw filesError;

      if (folders) {
        folders.forEach((f: any) => {
          this.folders.set(f.id, {
            id: f.id,
            name: f.name,
            path: f.path,
            parentId: f.parent_id,
            ownerId: f.owner_id,
            createdAt: new Date(f.created_at).getTime(),
            updatedAt: new Date(f.updated_at).getTime(),
          });
        });
      }
      if (files) {
        files.forEach((f: any) => {
          this.files.set(f.id, {
            id: f.id,
            name: f.name,
            extension: f.extension,
            size: Number(f.size),
            mimeType: f.mime_type,
            path: f.path,
            parentId: f.parent_id,
            ownerId: f.owner_id,
            createdAt: new Date(f.created_at).getTime(),
            updatedAt: new Date(f.updated_at).getTime(),
            metadata: f.metadata,
            contentUrl: f.storage_path ? `${process.env.SUPABASE_URL}/storage/v1/object/public/nexus-files/${f.storage_path}` : undefined,
          });
        });
      }
      this.loadedUsers.add(ownerId);
    } catch (err) {
      console.warn('[NexusFS] loadUserFiles failed:', err);
    }
  }

  private detectCategory(ext: string, mime: string): FileCategory {
    const e = ext.toLowerCase();
    if (['doc', 'docx', 'pdf', 'txt', 'md'].includes(e)) return 'document';
    if (['xls', 'xlsx', 'csv'].includes(e)) return 'spreadsheet';
    if (['ppt', 'pptx'].includes(e)) return 'presentation';
    if (['jpg', 'jpeg', 'png', 'svg', 'gif'].includes(e)) return 'image';
    if (['mp4', 'mov', 'avi'].includes(e)) return 'video';
    if (['js', 'ts', 'tsx', 'py', 'go', 'rs', 'html', 'css'].includes(e)) return 'code';
    if (['zip', 'tar', 'gz', 'rar'].includes(e)) return 'archive';
    return 'other';
  }

  private async generateAITags(name: string, content: string): Promise<string[]> {
    // In a real implementation, this would call LLM
    const tags = ['nexus-os'];
    if (name.toLowerCase().includes('tax')) tags.push('financial', 'tax-2025');
    if (name.toLowerCase().includes('plan')) tags.push('strategy', 'roadmap');
    if (content.length > 1000) tags.push('long-form');
    return tags;
  }

  private async generateAISummary(name: string, content: string): Promise<string> {
    return `This is an automatically generated summary for "${name}". Content appears to be related to ${name.split('.')[0]}.`;
  }

  public async getFiles(parentId: string | null, ownerId: string): Promise<NexusFile[]> {
    await this.loadUserFiles(ownerId);
    return Array.from(this.files.values()).filter(f => f.parentId === parentId && f.ownerId === ownerId);
  }

  public async getFolders(parentId: string | null, ownerId: string): Promise<NexusFolder[]> {
    await this.loadUserFiles(ownerId);
    return Array.from(this.folders.values()).filter(f => f.parentId === parentId && f.ownerId === ownerId);
  }

  public async searchFiles(query: string, ownerId: string): Promise<NexusFile[]> {
    await this.loadUserFiles(ownerId);
    const q = query.toLowerCase();
    return Array.from(this.files.values()).filter(f => 
      f.ownerId === ownerId && (
        f.name.toLowerCase().includes(q) || 
        f.metadata.tags.some(t => t.toLowerCase().includes(q)) ||
        f.metadata.aiSummary?.toLowerCase().includes(q)
      )
    );
  }

  public async readFile(path: string, ownerId: string): Promise<string> {
    await this.loadUserFiles(ownerId);
    const file = Array.from(this.files.values()).find(f => f.path === path && f.ownerId === ownerId);
    if (!file) throw new Error(`File not found: ${path}`);

    if (file.contentUrl) {
      const res = await fetch(file.contentUrl);
      if (!res.ok) throw new Error(`Failed to fetch file content: ${res.statusText}`);
      return await res.text();
    }

    throw new Error(`File content not available for ${path}`);
  }
}

export const nexusFS = new NexusFS();
