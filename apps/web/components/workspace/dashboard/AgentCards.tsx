'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Database, Zap } from 'lucide-react';

import { useAgents } from '../../../hooks/useAgents';

export function AgentCards() {
  const { agents, loading } = useAgents('All', '');

  const displayAgents = agents.slice(0, 3);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-medium text-white">Quick Launch Agents</h2>
      </div>
      
      {loading ? (
        <div className="text-zinc-500 text-sm mt-4 animate-pulse">Scanning Agent Database...</div>
      ) : displayAgents.length === 0 ? (
        <div className="text-zinc-500 text-sm mt-4">No agents available. Check the marketplace.</div>
      ) : displayAgents.map((agent, i) => (
        <motion.div
          key={agent.id || i}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 + (0.1 * i) }}
          className="bg-[#161616] border border-white/5 rounded-3xl p-6 hover:bg-[#1c1c1c] transition-colors cursor-pointer group"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="text-zinc-500 text-xs font-medium uppercase tracking-wider">
              {agent.category || 'Utility'}
            </div>
            <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${
              agent.installed ? 'bg-emerald-500/10 text-emerald-500' : 'bg-violet-500/10 text-violet-500'
            }`}>
              • {agent.installed ? 'Installed' : 'Available'}
            </div>
          </div>
          
          <h3 className="text-xl font-medium text-white mb-2 group-hover:text-violet-400 transition-colors">
            {agent.name}
          </h3>
          <p className="text-zinc-400 text-sm mb-6 line-clamp-2 leading-relaxed">
            {agent.description}
          </p>
          
          <div className="flex items-center gap-4 text-xs font-medium">
            <div className="flex items-center gap-2 text-zinc-500 bg-white/5 px-3 py-1.5 rounded-full">
              <Database size={12} />
              {agent.cost || 'Free'}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
