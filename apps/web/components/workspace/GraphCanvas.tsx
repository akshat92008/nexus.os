'use client';
 
import React, { useCallback, useEffect, useState } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
  Panel
} from 'reactflow';
import 'reactflow/dist/style.css';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Zap, 
  CheckCircle, 
  AlertCircle, 
  Brain,
  Code,
  Layout,
  MessageSquare,
  Target
} from 'lucide-react';
import type { GraphNode, GraphEdge, AgentType } from '@nexus-os/types';
 
const AGENT_COLORS: Record<AgentType | string, string> = {
  researcher: '#3b82f6',
  analyst: '#8b5cf6',
  writer: '#ec4899',
  coder: '#10b981',
  strategist: '#f59e0b',
  summarizer: '#64748b',
  chief_analyst: '#7c6af7',
};
 
const AGENT_ICONS: Record<AgentType | string, any> = {
  researcher: Search,
  analyst: Zap,
  writer: Layout,
  coder: Code,
  strategist: Target,
  summarizer: MessageSquare,
  chief_analyst: Brain,
};
 
const CustomNode = ({ data }: { data: any }) => {
  const Icon = AGENT_ICONS[data.agentType] || Brain;
  const color = AGENT_COLORS[data.agentType] || '#7c6af7';
 
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="px-4 py-3 shadow-xl rounded-xl bg-slate-900/90 border border-slate-700/50 backdrop-blur-md min-w-[180px]"
    >
      <div className="flex items-center gap-3">
        <div 
          className="p-2 rounded-lg"
          style={{ backgroundColor: `${color}20`, color }}
        >
          <Icon size={18} />
        </div>
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
            {data.agentType}
          </div>
          <div className="text-sm font-semibold text-slate-100 truncate max-w-[120px]">
            {data.label}
          </div>
        </div>
        {data.status === 'completed' && <CheckCircle size={14} className="text-emerald-400" />}
      </div>
      
      {data.artifact && (
        <div className="mt-2 pt-2 border-t border-slate-800 text-[10px] text-slate-400 italic line-clamp-2">
          {data.artifact.substring(0, 100)}...
        </div>
      )}
    </motion.div>
  );
};
 
const nodeTypes = {
  default: CustomNode,
  input: ({ data }: any) => (
    <div className="px-6 py-4 bg-indigo-600 rounded-2xl shadow-lg border-2 border-indigo-400/50 text-white font-bold flex items-center gap-3">
      <Target size={20} />
      {data.label}
    </div>
  ),
};
 
interface GraphCanvasProps {
  sessionId: string;
  refreshInterval?: number;
}
 
export function GraphCanvas({ sessionId, refreshInterval = 5000 }: GraphCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
 
  const fetchGraphData = useCallback(async () => {
    try {
      const res = await fetch(`http://localhost:3001/api/mission/${sessionId}/graph`);
      if (!res.ok) throw new Error('Refresh failed');
      const data = await res.json();
      
      setNodes(data.nodes);
      setEdges(data.edges);
      setLoading(false);
    } catch (err) {
      console.error('[Graph] ❌ Fetch Error:', err);
    }
  }, [sessionId, setNodes, setEdges]);
 
  useEffect(() => {
    fetchGraphData();
    const interval = setInterval(fetchGraphData, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchGraphData, refreshInterval]);
 
  return (
    <div className="w-full h-full bg-slate-950 relative overflow-hidden flex flex-col">
      <Panel position="top-left" className="m-4">
        <div className="p-3 bg-slate-900/80 backdrop-blur border border-slate-700 rounded-lg shadow-2xl">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Zap size={14} className="text-amber-400" />
            Reasoning Canvas
          </h3>
          <p className="text-[10px] text-slate-500 mt-1">Real-time agent lineage graph</p>
        </div>
      </Panel>
 
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        className="w-full h-full"
      >
        <Background gap={20} color="#334155" variant="dots" />
        <Controls showInteractive={false} className="bg-slate-900 border-slate-700 fill-slate-100" />
      </ReactFlow>
 
      {loading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
            >
              <Brain size={48} className="text-indigo-500 animate-pulse" />
            </motion.div>
            <span className="text-indigo-400 font-mono text-sm tracking-widest translate-x-2">BOOTING OBSERVE_LAYER...</span>
          </div>
        </div>
      )}
    </div>
  );
}
