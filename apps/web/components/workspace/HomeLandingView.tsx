'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Sparkles, Command, ArrowRight } from 'lucide-react';
import { useNexusStore } from '../../store/nexusStore';
import { API_BASE } from '../../lib/constants';
import { createClient } from '../../lib/supabase';

export function HomeLandingView() {
  const [prompt, setPrompt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const setActiveWorkspace = useNexusStore(s => s.setActiveWorkspace);
  const addToast = useNexusStore(s => s.addToast);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`${API_BASE}/api/orchestrate?goal=${encodeURIComponent(prompt)}`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to start mission');
      
      const { missionId } = await response.json();
      setActiveWorkspace(missionId);
      
    } catch (err: any) {
      addToast(err.message || 'Error starting mission');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 h-full flex flex-col items-center justify-center p-8 bg-[#0D0D0D] relative overflow-hidden">
      
      {/* Background Orbs */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-violet-600/20 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-fuchsia-600/10 rounded-full blur-[128px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-3xl space-y-8 z-10"
      >
        <div className="text-center space-y-4">
           <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-[0_0_40px_rgba(139,92,246,0.3)] mb-8">
              <Sparkles size={32} className="text-white" />
           </div>
           <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight">
             How can I help you today?
           </h1>
           <p className="text-lg text-zinc-400 font-medium max-w-xl mx-auto">
             Enter a goal, drop a file, or ask the Master Brain to orchestrate a complete mission.
           </p>
        </div>

        <form onSubmit={handleSubmit} className="relative group">
           <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
              {isSubmitting ? (
                 <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                 <Search size={22} className="text-violet-400 group-focus-within:text-violet-300 transition-colors" />
              )}
           </div>
           
           <input 
              type="text" 
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={isSubmitting}
              autoFocus
              placeholder="e.g. 'Analyze Q3 financial reports and draft an executive summary'" 
              className="w-full bg-[#161616]/80 backdrop-blur-xl border border-white/10 rounded-3xl py-6 pl-16 pr-20 text-lg text-white placeholder:text-zinc-500 focus:outline-none focus:ring-4 focus:ring-violet-500/20 focus:border-violet-500/50 transition-all shadow-2xl disabled:opacity-50"
           />
           
           <button 
              type="submit"
              disabled={!prompt.trim() || isSubmitting}
              className="absolute inset-y-3 right-3 aspect-square bg-violet-600 rounded-2xl flex items-center justify-center text-white hover:bg-violet-500 transition-all shadow-lg disabled:opacity-0 disabled:scale-95 duration-200"
           >
              <ArrowRight size={20} />
           </button>
           
           <div className="absolute -bottom-8 left-0 right-0 flex items-center justify-center gap-6">
              <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-zinc-500">
                 <Command size={12} />
                 <span>Press Enter to run</span>
              </div>
              <div className="w-1 h-1 rounded-full bg-zinc-800" />
              <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-zinc-500">
                 <span>Supports multi-agent workflows</span>
              </div>
           </div>
        </form>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-12">
           {[
             { label: 'Draft marketing strategy', icon: Sparkles },
             { label: 'Review latest pull requests', icon: Command },
             { label: 'Scrape competitor pricing', icon: Search },
             { label: 'Summarize internal wiki', icon: ArrowRight }
           ].map((suggestion, idx) => (
             <button
                key={idx}
                type="button"
                onClick={() => setPrompt(suggestion.label)}
                className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/5 hover:border-violet-500/30 transition-all text-left flex flex-col gap-3 group"
             >
                <div className="p-2 bg-black/20 rounded-lg w-fit group-hover:bg-violet-500/20 transition-colors">
                   <suggestion.icon size={16} className="text-zinc-500 group-hover:text-violet-400" />
                </div>
                <span className="text-xs font-bold text-zinc-400 group-hover:text-zinc-200">{suggestion.label}</span>
             </button>
           ))}
        </div>
      </motion.div>
    </div>
  );
}
