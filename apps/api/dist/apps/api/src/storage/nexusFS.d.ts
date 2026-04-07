/**
 * NexusOS — Smart File System (NexusFS)
 *
 * A virtualized, AI-powered file system with automatic categorization,
 * versioning, and unified data access.
 */
import type { NexusFile, NexusFolder } from '@nexus-os/types';
declare class NexusFS {
    private files;
    private folders;
    constructor();
    createFolder(id: string, name: string, parentId: string | null, ownerId: string): NexusFolder;
    uploadFile(name: string, content: string, parentId: string, ownerId: string, mimeType: string): Promise<NexusFile>;
    private detectCategory;
    private generateAITags;
    private generateAISummary;
    getFiles(parentId: string | null): NexusFile[];
    getFolders(parentId: string | null): NexusFolder[];
    searchFiles(query: string): NexusFile[];
}
export declare const nexusFS: NexusFS;
export {};
//# sourceMappingURL=nexusFS.d.ts.map