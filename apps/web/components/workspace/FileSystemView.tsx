'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  File, 
  Folder, 
  Search, 
  Grid, 
  List, 
  Filter, 
  MoreVertical, 
  Download, 
  Trash2, 
  Eye, 
  Clock, 
  Tag, 
  ChevronRight, 
  X,
  Plus,
  Upload,
  HardDrive,
  Target
} from 'lucide-react';
import { useNexusStore } from '../../store/nexusStore';
import type { NexusFile, NexusFolder } from '@nexus-os/types';

export function FileSystemView() {
  const { ui, toggleLibraryView, fsItems, isFsLoading, fetchFsItems, uploadFsFile, searchFs } = useNexusStore();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFolderId, setActiveFolderId] = useState<string>('root');
  
  useEffect(() => {
    if (ui.libraryViewOpen) {
      fetchFsItems(activeFolderId);
    }
  }, [ui.libraryViewOpen, activeFolderId, fetchFsItems]);

  if (!ui.libraryViewOpen) return null;

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    searchFs(q);
  };

  const handleUploadClick = async () => {
    const name = prompt('Enter file name (e.g. data.txt):');
    if (!name) return;
    const content = prompt('Enter file content:');
    if (!content) return;
    await uploadFsFile(name, content, activeFolderId);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] grid place-items-center bg-zinc-950/90 backdrop-blur-3xl p-4 md:p-12"
        onClick={toggleLibraryView}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 30 }}
          className="relative w-full max-w-7xl h-full max-h-[90vh] bg-zinc-900/40 border border-zinc-800 rounded-[48px] shadow-[0_40px_100px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <header className="p-8 border-b border-zinc-800/60 bg-zinc-900/20 backdrop-blur-xl flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-violet-600/20">
                <HardDrive size={28} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-zinc-100 tracking-tight">NexusFS</h2>
                <div className="flex items-center gap-2 text-xs font-bold text-zinc-500 uppercase tracking-widest">
                  <span>Intelligent storage</span>
                  <span className="w-1 h-1 rounded-full bg-zinc-700" />
                  <span>{fsItems.length} Elements</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button 
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                className="p-3 rounded-xl bg-zinc-800/80 text-zinc-400 hover:text-white transition-all shadow-lg"
              >
                {viewMode === 'grid' ? <List size={20} /> : <Grid size={20} />}
              </button>
              <button 
                onClick={toggleLibraryView}
                className="p-3 rounded-xl bg-zinc-800/80 text-zinc-400 hover:text-white transition-all shadow-lg"
              >
                <X size={20} />
              </button>
            </div>
          </header>

          <div className="flex-1 flex overflow-hidden">
            {/* Sidebar Controls */}
            <aside className="w-72 border-r border-zinc-800/60 p-8 hidden lg:flex flex-col gap-10 bg-zinc-950/20">
              <div className="space-y-6">
                <button 
                  onClick={handleUploadClick}
                  className="w-full py-4 rounded-3xl bg-violet-600 text-white font-bold text-sm shadow-xl shadow-violet-600/30 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <Plus size={18} />
                  Upload File
                </button>

                <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase tracking-[.3em] text-zinc-600 pl-2">Locations</h3>
                  <div className="space-y-1">
                    {['All Files', 'Workspaces', 'Recent', 'Starred', 'Trash'].map((loc, i) => (
                      <button key={i} className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all ${activeFolderId === 'root' && i === 0 ? 'bg-zinc-800/80 text-violet-400 shadow-inner' : 'text-zinc-500 hover:bg-zinc-800/40 hover:text-zinc-300'}`}>
                         {loc === 'All Files' && <File size={16} />}
                         {loc === 'Workspaces' && <Target size={16} />}
                         {loc === 'Recent' && <Clock size={16} />}
                         {loc === 'Starred' && <Plus size={16} />}
                         {loc === 'Trash' && <Trash2 size={16} />}
                         {loc}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase tracking-[.3em] text-zinc-600 pl-2">Intelligence</h3>
                  <div className="p-5 rounded-3xl bg-violet-600/10 border border-violet-500/10 flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-violet-400">
                      <Tag size={14} />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Smart Filters</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 leading-relaxed font-medium">AI tags documents based on content analysis automatically.</p>
                  </div>
                </div>
              </div>

              <div className="mt-auto space-y-4">
                 <div className="flex justify-between text-[10px] font-black text-zinc-600 uppercase tracking-widest px-2">
                    <span>Usage</span>
                    <span className="text-zinc-400">0.4 GB / 1 TB</span>
                 </div>
                 <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-violet-500 w-[1%]" />
                 </div>
              </div>
            </aside>

            {/* Content Area */}
            <main className="flex-1 flex flex-col bg-zinc-950/20">
              <div className="p-8 pb-4">
                <div className="relative group">
                  <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-violet-400 transition-colors" size={20} />
                  <input 
                    type="text" 
                    placeholder="Search your neural files and smart summaries..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="w-full bg-zinc-950/60 border border-zinc-800/80 rounded-[24px] py-5 px-14 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-violet-500/40 focus:ring-4 focus:ring-violet-500/5 transition-all shadow-inner"
                  />
                </div>
              </div>

              <div className="flex-1 p-8 pt-4 overflow-y-auto custom-scrollbar">
                {isFsLoading ? (
                  <div className="flex flex-col items-center justify-center h-64 text-zinc-600 gap-4">
                    <div className="w-8 h-8 rounded-full border-2 border-t-violet-500 border-zinc-800 animate-spin" />
                    <p className="text-xs font-bold uppercase tracking-widest">Indexing NexusFS...</p>
                  </div>
                ) : viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                    {(fsItems as any[]).map(item => (
                      <motion.div 
                        key={item.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => 'path' in item ? null : setActiveFolderId(item.id)}
                        className="p-6 rounded-[32px] bg-zinc-900/40 border border-zinc-800/60 hover:border-violet-500/40 transition-all cursor-pointer group flex flex-col"
                      >
                         <div className="flex items-start justify-between mb-6">
                            <div className="p-4 rounded-2xl bg-zinc-800/80 text-zinc-500 group-hover:scale-110 transition-transform group-hover:bg-violet-600/10 group-hover:text-violet-400 shadow-lg">
                               {('path' in item) ? <File size={24} /> : <Folder size={24} />}
                            </div>
                            <button className="p-2 text-zinc-600 hover:text-white transition-colors opacity-0 group-hover:opacity-100">
                               <MoreVertical size={18} />
                            </button>
                         </div>
                         <h3 className="text-base font-bold text-zinc-100 mb-1 group-hover:text-violet-300 transition-colors uppercase tracking-tight">{item.name}</h3>
                         <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-4">
                           {('size' in item) ? `${(item.size / 1024).toFixed(1)} KB` : 'Folder'} • {new Date(item.updatedAt).toLocaleDateString()}
                         </p>
                         
                         {('metadata' in item) && item.metadata.aiSummary && (
                           <div className="mb-4 p-3 rounded-xl bg-zinc-950/40 border border-zinc-800/50 text-[11px] text-zinc-400 italic font-medium leading-relaxed">
                              {item.metadata.aiSummary}
                           </div>
                         )}

                         <div className="flex flex-wrap gap-2 mt-auto">
                            {('metadata' in item) && item.metadata.tags?.map((t: string) => (
                              <span key={t} className="px-2 py-0.5 rounded-md bg-zinc-800 text-[10px] font-bold text-zinc-500 hover:text-violet-400 transition-colors uppercase tracking-widest border border-zinc-700/50">
                                #{t}
                              </span>
                            ))}
                         </div>
                      </motion.div>
                    ))}

                    <div 
                      onClick={handleUploadClick}
                      className="p-6 rounded-[32px] border-2 border-dashed border-zinc-800/60 flex flex-col items-center justify-center text-zinc-600 hover:bg-zinc-800/10 hover:border-violet-500/30 transition-all cursor-pointer group"
                    >
                       <div className="p-4 rounded-full bg-zinc-900 mb-4 group-hover:scale-110 transition-transform shadow-lg group-hover:text-violet-400">
                          <Upload size={24} />
                       </div>
                       <p className="text-sm font-bold uppercase tracking-widest">Drop to Upload</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-zinc-600 text-sm font-medium italic">List view active...</p>
                  </div>
                )}
              </div>
            </main>
          </div>

          {/* Status Bar */}
          <footer className="px-8 py-3 bg-zinc-950/60 border-t border-zinc-800/40 backdrop-blur-xl flex items-center justify-between">
             <div className="flex items-center gap-6 text-[10px] font-bold tracking-widest uppercase text-zinc-600">
                <div className="flex items-center gap-2 text-emerald-500">
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                   VFS System Online
                </div>
                <div>E2EE Protocol: AES-256</div>
                <div>Auto-Indexing Active</div>
             </div>
             <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500">
                NexusFS Engine v3.0 — Continuous Data Integrity Protocol
             </div>
          </footer>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

