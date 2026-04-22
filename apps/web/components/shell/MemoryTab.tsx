'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { Database, Search, History, BookOpen } from 'lucide-react';

export const MemoryTab: React.FC = () => {
  const [status, setStatus] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await invoke('get_memory_status');
        setStatus(res);
      } catch (err) {
        console.error('Memory status fetch failed', err);
      }
    };
    fetchStatus();
  }, []);

  return (
    <div className="p-8 h-full flex flex-col space-y-8 bg-[#0a0a0a]">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400 border border-blue-500/20">
            <Database size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">Sovereign Memory</h2>
            <p className="text-xs text-white/40 font-mono">Status: {status?.is_active ? 'ENCRYPTED & ONLINE' : 'IDLE'}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2 text-[10px] uppercase font-bold text-white/30">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span>Local SQLite-Vec Active</span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative group">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-white/20 group-focus-within:text-blue-400 transition-colors">
          <Search size={18} />
        </div>
        <input 
          type="text" 
          placeholder="Search semantic history..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-6 text-sm focus:outline-none focus:border-blue-500/50 transition-all"
        />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
          <div className="flex items-center space-x-3 text-white/40 mb-2">
            <History size={16} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Session Store</span>
          </div>
          <p className="text-2xl font-bold font-mono">1,248</p>
          <p className="text-[10px] text-white/20 mt-1">Interactions logged</p>
        </div>
        <div className="bg-white/5 border border-white/5 p-4 rounded-2xl">
          <div className="flex items-center space-x-3 text-white/40 mb-2">
            <BookOpen size={16} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Knowledge Store</span>
          </div>
          <p className="text-2xl font-bold font-mono">42</p>
          <p className="text-[10px] text-white/20 mt-1">Semantic chunks indexed</p>
        </div>
      </div>

      {/* Placeholder for results */}
      <div className="flex-grow flex flex-col items-center justify-center border border-dashed border-white/10 rounded-3xl p-12 text-center opacity-40">
        <Database size={48} className="mb-4 text-white/20" />
        <p className="text-sm font-medium">Memory Retrieval Results</p>
        <p className="text-xs mt-1 max-w-[200px]">Search your long-term memory to see semantic associations from previous missions.</p>
      </div>
    </div>
  );
};
