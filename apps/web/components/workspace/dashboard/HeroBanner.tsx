'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Play } from 'lucide-react';

export function HeroBanner() {
  return (
    <div className="relative w-full rounded-[32px] overflow-hidden bg-[#161616] border border-white/5 p-12 min-h-[320px] flex flex-col justify-center">
      {/* Grid Pattern Background */}
      <div 
        className="absolute inset-0 opacity-20 pointer-events-none" 
        style={{ 
          backgroundImage: 'radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)', 
          backgroundSize: '40px 40px' 
        }} 
      />
      
      {/* Decorative Glow */}
      <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-64 h-64 bg-violet-600/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative z-10 max-w-2xl">
        <h1 className="text-4xl md:text-5xl font-medium text-white tracking-tight mb-4 leading-tight">
          Meet NeuroNest — Your Modular <br />
          Command Center for Everything AI
        </h1>
        <p className="text-zinc-400 text-lg mb-8 leading-relaxed">
          Welcome to NeuroNest — a modular desktop dashboard built to amplify your creative and operational workflows with AI at the center.
        </p>

        <button className="flex items-center gap-3 bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-white px-6 py-3 rounded-full transition-all group">
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
            <Play size={14} fill="currentColor" />
          </div>
          <span className="font-medium">Getting Started: Watch Now</span>
        </button>
      </div>

      {/* Floating Icons (Simplified) */}
      <div className="absolute top-1/2 right-12 -translate-y-1/2 hidden lg:flex flex-col gap-6">
         {/* These would ideally be real logos, using placeholders for now */}
         <div className="flex gap-6 items-end">
            <IconBox delay={0.1} />
            <IconBox delay={0.2} large />
         </div>
         <div className="flex gap-6 items-start translate-x-12">
            <IconBox delay={0.3} large />
            <IconBox delay={0.4} />
         </div>
      </div>
    </div>
  );
}

function IconBox({ delay, large }: { delay: number; large?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.8 }}
      className={`${large ? 'w-20 h-20' : 'w-16 h-16'} rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md flex items-center justify-center shadow-2xl`}
    >
       <div className={`w-8 h-8 rounded-full bg-white/10 animate-pulse`} />
    </motion.div>
  );
}
