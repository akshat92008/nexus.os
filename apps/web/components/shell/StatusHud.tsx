'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Cpu, Brain, Zap, ShieldCheck } from 'lucide-react';

interface StatusHudProps {
  brainStatus: 'online' | 'offline' | 'error';
  nerveStatus: 'connected' | 'reconnecting' | 'idle';
  currentAgent: string;
}

export const StatusHud: React.FC<StatusHudProps> = ({ 
  brainStatus, 
  nerveStatus, 
  currentAgent 
}) => {
  return (
    <div className="w-64 bg-black/40 backdrop-blur-xl border-l border-white/10 p-6 flex flex-col space-y-8">
      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-white/40 mb-4">Core Telemetry</h3>
        <div className="space-y-4">
          <StatusItem 
            icon={<Brain size={16} />} 
            label="Cloud Brain" 
            status={brainStatus === 'online' ? 'ACTIVE' : brainStatus.toUpperCase()} 
            color={brainStatus === 'online' ? 'text-green-400' : 'text-red-400'}
          />
          <StatusItem 
            icon={<Zap size={16} />} 
            label="Local Nerve" 
            status={nerveStatus.toUpperCase()} 
            color={nerveStatus === 'connected' ? 'text-blue-400' : 'text-yellow-400'}
          />
          <StatusItem 
            icon={<Cpu size={16} />} 
            label="Agent Core" 
            status={currentAgent} 
            color="text-purple-400"
          />
          <StatusItem 
            icon={<ShieldCheck size={16} />} 
            label="Safety Layer" 
            status="HARDENED" 
            color="text-cyan-400"
          />
          <StatusItem 
            icon={<ShieldCheck size={14} className="opacity-50" />} 
            label="GUI Observer" 
            status="FOCUS: ACTIVE" 
            color="text-yellow-400"
          />
        </div>
      </div>

      <div className="mt-auto">
        <div className="bg-white/5 rounded-lg p-4 border border-white/5">
          <p className="text-[10px] text-white/30 uppercase font-bold mb-1">Session Protocol</p>
          <p className="text-xs text-white/70 font-mono">NEXUS-OS-V3-NATIVE</p>
        </div>
      </div>
    </div>
  );
};

const StatusItem = ({ icon, label, status, color }: { 
  icon: React.ReactNode; 
  label: string; 
  status: string; 
  color: string 
}) => (
  <div className="flex items-center justify-between">
    <div className="flex items-center space-x-3 text-white/60">
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </div>
    <motion.span 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`text-[10px] font-bold ${color} bg-black/20 px-2 py-0.5 rounded border border-white/5`}
    >
      {status}
    </motion.span>
  </div>
);
