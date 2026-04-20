'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell, 
  Mail, 
  MessageSquare, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  X, 
  User,
  Search,
  Filter,
  Inbox as InboxIcon,
  Archive,
  Star,
  Settings
} from 'lucide-react';

import { useNexusStore } from '../../store/nexusStore';

export function UnifiedInbox({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { inbox, markInboxRead, clearInbox } = useNexusStore();
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'system': return CheckCircle2;
      case 'agent': return MessageSquare;
      case 'email': return Mail;
      case 'alert': return AlertTriangle;
      default: return Bell;
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case 'system': return 'text-emerald-400';
      case 'agent': return 'text-violet-400';
      case 'email': return 'text-cyan-400';
      case 'alert': return 'text-rose-400';
      default: return 'text-zinc-400';
    }
  };

  const filtered = inbox.filter(m => {
    const matchesFilter = filter === 'All' || m.type.toLowerCase() === filter.toLowerCase();
    const matchesSearch = m.title.toLowerCase().includes(search.toLowerCase()) || 
                         m.content.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        className="fixed top-20 right-6 z-[120] w-full max-w-md h-[80vh] bg-zinc-900/60 border border-zinc-800 rounded-[32px] shadow-2xl backdrop-blur-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <header className="p-6 border-b border-zinc-800/60 bg-zinc-900/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <InboxIcon size={18} className="text-violet-400" />
              <h2 className="text-sm font-black uppercase tracking-widest text-zinc-100">Unified Inbox</h2>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-500 transition-colors">
              <X size={16} />
            </button>
          </div>

          <div className="relative group mb-4">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-violet-400" />
            <input 
              type="text" 
              placeholder="Search notifications..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-zinc-950/50 border border-zinc-800/80 rounded-xl py-2 pl-9 pr-4 text-xs text-zinc-100 placeholder:text-zinc-700 outline-none focus:border-violet-500/50"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {['All', 'System', 'Agent', 'Email', 'Alert'].map(f => (
              <button 
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${filter === f ? 'bg-violet-600/10 text-violet-400 border border-violet-500/20' : 'text-zinc-600 hover:text-zinc-400'}`}
              >
                {f}
              </button>
            ))}
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-3">
          {filtered.map(msg => {
            const Icon = getIcon(msg.type);
            const color = getColor(msg.type);
            return (
              <motion.div
                layout
                key={msg.id}
                onClick={() => markInboxRead(msg.id)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer group ${msg.read ? 'bg-zinc-900/30 border-zinc-800/50 grayscale-[0.5]' : 'bg-zinc-900 border-zinc-800/80 hover:border-violet-500/30 shadow-lg'}`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-xl bg-zinc-950/50 ${color}`}>
                    <Icon size={18} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-xs font-bold text-zinc-200">{msg.title}</h3>
                      <span className="text-[10px] font-bold text-zinc-600">{msg.timestamp}</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 leading-relaxed line-clamp-2 mb-2">
                      {msg.content}
                    </p>
                    <div className="flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onClose();
                        }}
                        className="text-[10px] font-black uppercase tracking-widest text-violet-400 hover:text-violet-300"
                      >
                        View
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          markInboxRead(msg.id);
                        }}
                        className="text-[10px] font-black uppercase tracking-widest text-zinc-600 hover:text-zinc-300"
                      >
                        Archive
                      </button>
                    </div>
                  </div>
                  {!msg.read && (
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1" />
                  )}
                </div>
              </motion.div>
            );
          })}
          
          {filtered.length === 0 && (
             <div className="flex flex-col items-center justify-center py-20 text-zinc-600">
                <Archive size={40} className="mb-4 opacity-20" />
                <p className="text-sm font-bold">Clear Skies</p>
                <p className="text-[11px] mt-1">No notifications found in this category.</p>
             </div>
          )}
        </div>

        {/* Footer */}
        <footer className="p-4 border-t border-zinc-800/60 bg-zinc-950/40 flex items-center justify-between">
           <button 
             onClick={() => {
                useNexusStore.getState().addInboxEntry({
                  type: 'system',
                  title: 'Settings Sync',
                  content: 'Your OS preferences have been synchronized with the cloud vault.',
                  priority: 'medium'
                });
             }}
             className="text-[10px] font-bold text-zinc-500 hover:text-zinc-300 flex items-center gap-1"
           >
             <Settings size={12} /> Core Settings
           </button>
           <button 
             onClick={() => clearInbox()}
             className="text-[10px] font-bold text-zinc-500 hover:text-zinc-300"
           >
             Clear Inbox
           </button>
        </footer>
      </motion.div>
    </AnimatePresence>
  );
}
