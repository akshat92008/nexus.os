'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  ArrowUpRight, 
  CheckCircle2, 
  ShieldCheck, 
  Zap, 
  Globe, 
  Code, 
  PenTool, 
  Activity, 
  Target,
  Sparkles,
  X,
  Filter
} from 'lucide-react';
import { useNexusStore } from '../../store/nexusStore';
import { createClient } from '../../lib/supabase';

const CATEGORIES = ['All', 'Productivity', 'Business', 'Learning', 'Finance', 'Creative', 'Technical'];

const ICON_MAP: Record<string, any> = {
  'Search': Search,
  'Activity': Activity,
  'PenTool': PenTool,
  'Code': Code,
  'Target': Target,
  'Zap': Zap,
  'Sparkles': Sparkles,
  'Globe': Globe,
};

export function AgentMarketplace() {
  const { ui, toggleAgentsView, installedAgentIds, installAgent } = useNexusStore();
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/agents`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to load agents');
      }

      setAgents(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load agents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!ui.agentsViewOpen) return;
    void fetchAgents();
  }, [ui.agentsViewOpen, fetchAgents]);

  if (!ui.agentsViewOpen) return null;

  const mappedAgents = agents.map(a => ({
    ...a,
    icon: ICON_MAP[a.icon] || Sparkles,
    color: 'text-violet-400', // Default colors if not in registry
    bg: 'bg-violet-500/10',
    installed: installedAgentIds.includes(a.id),
    rating: 4.8 + (Math.random() * 0.2), // Random for now
    users: Math.floor(Math.random() * 10) + 'k', // Random for now
  }));

  const filteredAgents = mappedAgents.filter(agent => {
    const matchesCategory = activeCategory === 'All' || 
                           agent.category.toLowerCase() === activeCategory.toLowerCase();
    const matchesSearch = agent.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         agent.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[110] bg-zinc-950/90 backdrop-blur-2xl p-4 md:p-8 flex flex-col items-center justify-center"
        onClick={toggleAgentsView}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="w-full max-w-6xl h-full max-h-[85vh] bg-zinc-900/50 border border-zinc-800 rounded-[40px] shadow-2xl flex flex-col overflow-hidden relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button 
            onClick={toggleAgentsView}
            className="absolute top-8 right-8 p-3 rounded-full bg-zinc-800/50 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-all z-10"
          >
            <X size={20} />
          </button>

          {/* Sidebar / Categories */}
          <div className="flex h-full">
            <div className="w-64 border-r border-zinc-800/50 p-8 hidden lg:flex flex-col gap-8 bg-zinc-900/20">
              <div className="flex items-center gap-2 px-2">
                <Sparkles size={20} className="text-violet-400" />
                <span className="text-sm font-black uppercase tracking-[.3em] text-zinc-100">Market</span>
              </div>

              <div className="space-y-1">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                      activeCategory === cat 
                        ? 'bg-violet-600/10 text-violet-400 border border-violet-500/20' 
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="mt-auto p-4 rounded-2xl bg-zinc-800/30 border border-zinc-800 flex flex-col gap-3">
                 <div className="flex items-center gap-2 text-emerald-400">
                    <ShieldCheck size={16} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Verified Apps</span>
                 </div>
                 <p className="text-[10px] text-zinc-500 leading-relaxed font-medium">
                   All agents in the Nexus marketplace are sandbox-verified for privacy and security.
                 </p>
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-8 border-b border-zinc-800/50 bg-zinc-900/10">
                <div className="flex items-center gap-4 mb-8">
                  <div className="flex-1 relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-violet-400 transition-colors" size={18} />
                    <input 
                      type="text" 
                      placeholder="Search agents, skills, or workflows..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-zinc-950/50 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-violet-500/50 focus:ring-4 focus:ring-violet-500/5 transition-all"
                    />
                  </div>
                  <button className="p-4 rounded-2xl bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
                    <Filter size={18} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">
                    Agent Ecosystem <span className="text-zinc-600 font-medium ml-2">({filteredAgents.length})</span>
                  </h1>
                  <div className="flex items-center gap-2 bg-zinc-800/50 rounded-lg px-3 py-1.5 border border-zinc-700/50">
                    <Zap size={14} className="text-violet-400" />
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">300 Credits Available</span>
                  </div>
                </div>
              </div>

              {/* Grid */}
              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {error ? (
                  <div className="flex h-full flex-col items-center justify-center gap-4 rounded-3xl border border-red-500/20 bg-red-950/20 p-8 text-center">
                    <p className="text-sm font-semibold text-red-300">{error}</p>
                    <button
                      onClick={() => void fetchAgents()}
                      className="rounded-2xl bg-violet-600 px-5 py-3 text-sm font-bold text-white hover:bg-violet-500 transition-all"
                    >
                      Retry
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {loading ? Array.from({ length: 6 }).map((_, idx) => (
                      <div key={idx} className="animate-pulse rounded-[28px] border border-zinc-800/80 bg-zinc-900/30 p-6">
                        <div className="h-8 w-8 rounded-2xl bg-zinc-800/70 mb-5" />
                        <div className="h-5 w-3/4 rounded-xl bg-zinc-800/70 mb-3" />
                        <div className="h-4 w-full rounded-xl bg-zinc-800/70 mb-2" />
                        <div className="h-4 w-5/6 rounded-xl bg-zinc-800/70 mt-auto" />
                      </div>
                    )) : filteredAgents.map((agent) => (
                      <motion.div
                        layout
                        key={agent.id}
                        className="p-6 rounded-[28px] bg-zinc-900/30 border border-zinc-800/80 hover:border-violet-500/30 transition-all cursor-pointer group hover:bg-zinc-900/50"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className={`p-3 rounded-2xl ${agent.bg} ${agent.color} transition-transform group-hover:scale-110`}>
                            <agent.icon size={24} />
                          </div>
                          <div className="flex flex-col items-end">
                             <div className="flex items-center gap-1 text-emerald-400 mb-1">
                                <span className="text-xs font-bold">{agent.rating}</span>
                                <Sparkles size={12} fill="currentColor" />
                             </div>
                             <span className="text-[10px] font-black text-zinc-600 uppercase tracking-tighter">{agent.users} users</span>
                          </div>
                        </div>

                        <h3 className="text-lg font-bold text-zinc-100 mb-2 group-hover:text-violet-400 transition-colors">
                          {agent.name}
                        </h3>
                        <p className="text-sm text-zinc-500 leading-relaxed mb-6 h-10 line-clamp-2">
                          {agent.description}
                        </p>

                        <div className="flex items-center justify-between mt-auto">
                          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">
                            {agent.category}
                          </span>
                        
                        {agent.installed ? (
                          <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                            <CheckCircle2 size={14} />
                            Installed
                          </div>
                        ) : (
                          <button 
                            onClick={() => installAgent(agent.id)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-bold uppercase tracking-wider hover:bg-violet-500 transition-all shadow-lg shadow-violet-600/10"
                          >
                            Install <ArrowUpRight size={14} />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

