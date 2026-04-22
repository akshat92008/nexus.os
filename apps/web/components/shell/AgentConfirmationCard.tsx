import React from 'react';
import { Bot, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export interface CompiledAgentNode {
  id: string;
  tool: string;
  target_app: string;
  action_description: string;
}

export interface CompiledAgent {
  name: string;
  trigger: string;
  nodes: CompiledAgentNode[];
}

interface Props {
  agent: CompiledAgent;
  onSave: () => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export const AgentConfirmationCard: React.FC<Props> = ({ agent, onSave, onCancel, isSaving }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      className="mt-6 p-6 bg-[#0d0d14]/90 border border-blue-500/30 rounded-2xl shadow-[0_0_50px_rgba(0,0,50,0.5)] relative overflow-hidden backdrop-blur-2xl max-w-xl w-full"
    >
      {/* Decorative Gradient Background */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 bg-blue-500/10 blur-3xl rounded-full" />
      <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-32 h-32 bg-indigo-500/10 blur-3xl rounded-full" />

      {/* Header */}
      <div className="flex items-center gap-4 mb-6 border-b border-white/10 pb-5">
        <div className="p-3 bg-blue-500/20 rounded-xl border border-blue-500/20">
          <Bot className="text-blue-400" size={28} />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white tracking-tight">Agent Compiled: {agent.name}</h3>
          <div className="flex items-center gap-2 text-xs text-blue-300/60 font-mono mt-1.5 uppercase tracking-widest">
            <Clock size={12} className="text-blue-400/50" />
            <span>TRIGGER: {agent.trigger}</span>
          </div>
        </div>
      </div>

      {/* DAG Workflow Visualizer */}
      <div className="space-y-4 mb-8">
        <h4 className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-3">Logic Execution Chain</h4>
        {agent.nodes.map((node, idx) => (
          <div key={node.id} className="flex items-center gap-4 group">
            <div className="flex flex-col items-center">
              <div className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] text-white/40 font-bold group-hover:bg-blue-500/20 group-hover:border-blue-500/40 transition-colors">
                {idx + 1}
              </div>
              {idx !== agent.nodes.length - 1 && <div className="w-[1px] h-6 bg-white/5 my-1" />}
            </div>
            
            <div className="flex-1 bg-white/5 border border-white/5 p-4 rounded-xl flex items-center justify-between group-hover:bg-white/10 transition-colors">
              <div className="flex flex-col gap-0.5">
                <span className="text-white/90 text-sm font-medium">{node.action_description}</span>
                <span className="text-[10px] text-white/30 font-mono">{node.tool}</span>
              </div>
              <span className="px-2.5 py-1 bg-blue-500/10 text-blue-400 text-[9px] uppercase tracking-wider rounded-md font-bold border border-blue-500/20 whitespace-nowrap">
                {node.target_app}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button 
          onClick={onSave}
          disabled={isSaving}
          className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold py-3.5 rounded-xl transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? 'ACTIVATING KERNEL...' : (
            <>
              <CheckCircle2 size={18} />
              SAVE & ACTIVATE AGENT
            </>
          )}
        </button>
        
        <button 
          onClick={onCancel}
          disabled={isSaving}
          className="flex-1 flex items-center justify-center gap-2 bg-white/5 hover:bg-red-500/10 text-white/50 hover:text-red-400 border border-white/10 hover:border-red-500/30 text-sm font-bold py-3.5 rounded-xl transition-all disabled:opacity-50"
        >
          <XCircle size={18} />
          DISCARD
        </button>
      </div>
    </motion.div>
  );
};
