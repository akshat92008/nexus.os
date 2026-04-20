'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { HeroBanner } from './HeroBanner';
import { StatsGrid } from './StatsGrid';
import { AgentCards } from './AgentCards';
import { ActivityList } from './ActivityList';
import { Search, BrainCircuit, History, Mail, Bell, Command } from 'lucide-react';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

export function NeuroDashboard() {
  return (
    <div className="flex-1 h-full overflow-y-auto custom-scrollbar bg-[#0D0D0D]">
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-[1600px] mx-auto p-8 space-y-8"
      >
        
        {/* Top Header Section */}
        <motion.header variants={itemVariants} className="flex items-center justify-between gap-8 mb-4">
          <div className="relative flex-1 max-w-2xl group">
             <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                <Search size={18} className="text-zinc-500 group-focus-within:text-violet-400 transition-colors" />
             </div>
             <input 
                type="text" 
                placeholder="Search..." 
                className="w-full bg-[#161616] border border-white/5 rounded-2xl py-4 pl-14 pr-16 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500/30 transition-all shadow-2xl"
             />
             <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 border border-white/10 text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                   <Command size={10} />
                   <span>+ F</span>
                </div>
             </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="flex items-center gap-2.5 bg-white text-zinc-900 px-5 py-3 rounded-2xl font-bold text-sm hover:bg-zinc-200 transition-colors shadow-xl">
               <BrainCircuit size={18} />
               AI Assistant
            </button>
            
            <div className="flex items-center gap-2 ml-4">
               <ToolbarButton icon={History} />
               <ToolbarButton icon={Mail} />
               <ToolbarButton icon={Bell} badge />
            </div>
          </div>
        </motion.header>

        {/* Hero Section */}
        <motion.div variants={itemVariants}>
          <HeroBanner />
        </motion.div>

        {/* Quick Stats Section */}
        <motion.section variants={itemVariants}>
          <div className="flex items-center justify-between mb-6">
             <h2 className="text-2xl font-medium text-white">Quick Stats</h2>
          </div>
          <StatsGrid />
        </motion.section>

        {/* Agents & Activity Grid */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-[1.2fr,0.8fr] gap-x-12 gap-y-8 pb-12">
           <AgentCards />
           <ActivityList />
        </motion.div>

      </motion.div>
    </div>
  );
}

function ToolbarButton({ icon: Icon, badge }: { icon: any; badge?: boolean }) {
  return (
    <button className="relative w-12 h-12 rounded-2xl bg-[#161616] border border-white/5 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-[#1c1c1c] transition-all group">
       <Icon size={20} />
       {badge && <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-rose-500 border-2 border-[#161616]" />}
    </button>
  );
}
