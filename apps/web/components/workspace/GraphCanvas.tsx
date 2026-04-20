'use client';
 
import React, { useCallback, useEffect, useState } from 'react';
import ReactFlow, { 
  Background, 
  BackgroundVariant,
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
  const isWorking = data.status === 'working' || data.status === 'running';

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ 
        scale: 1, 
        opacity: 1,
        boxShadow: isWorking ? `0 0 20px ${color}30` : '0 10px 30px rgba(0,0,0,0.5)'
      }}
      className={`px-4 py-3 rounded-2xl bg-zinc-900/90 border backdrop-blur-xl min-w-[200px] transition-colors duration-500 ${
        isWorking ? 'border-violet-500/50' : 'border-white/5'
      }`}
    >
      <div className="flex items-center gap-3">
        <div 
          className={`p-2 rounded-xl ${isWorking ? 'animate-pulse' : ''}`}
          style={{ backgroundColor: `${color}15`, color }}
        >
          <Icon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[9px] uppercase tracking-[0.15em] font-black text-zinc-500 mb-0.5">
            {data.agentType}
          </div>
          <div className="text-sm font-bold text-zinc-100 truncate">
            {data.label}
          </div>
        </div>
        {data.status === 'completed' && (
          <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
             <CheckCircle size={12} className="text-emerald-400" />
          </div>
        )}
      </div>
      
      {data.status === 'working' && (
         <div className="mt-3 h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
            <motion.div 
               animate={{ x: ['-100%', '100%'] }}
               transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
               className="h-full w-1/2 bg-gradient-to-r from-transparent via-violet-500 to-transparent"
            />
         </div>
      )}
    </motion.div>
  );
};

const nodeTypes = {
  default: CustomNode,
  input: ({ data }: any) => (
    <div className="px-6 py-4 bg-gradient-to-br from-violet-600 to-cyan-600 rounded-2xl shadow-[0_10px_30px_rgba(139,92,246,0.3)] border border-white/20 text-white font-black text-xs uppercase tracking-widest flex items-center gap-3">
      <Target size={18} />
      {data.label}
    </div>
  ),
};

class CanvasErrorBoundary extends React.Component<{}, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
          <div className="text-center">
            <p className="text-zinc-400 mb-2">Visualization error</p>
            <p className="text-zinc-600 text-xs">Mission is still running in the background</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function EmptyCanvas() {
  return (
    <div className="flex h-full items-center justify-center bg-zinc-950/90 rounded-3xl border border-dashed border-zinc-800 p-10 text-center text-zinc-400">
      <div>
        <p className="text-lg font-semibold text-white mb-2">No mission graph available yet</p>
        <p className="text-sm text-zinc-500">Start an orchestration to visualize mission progress.</p>
      </div>
    </div>
  );
}

interface GraphCanvasProps {
  sessionId: string;
  refreshInterval?: number;
}

export function GraphCanvas({ sessionId, refreshInterval = 5000 }: GraphCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);

  const fetchGraphData = useCallback(async () => {
    if (sessionId === 'initial') {
       setLoading(false);
       return;
    }
    try {
      const res = await fetch(`http://localhost:3001/api/mission/${sessionId}/graph`);
      if (!res.ok) throw new Error('Refresh failed');
      const data = await res.json();
      
      const polishedNodes = data.nodes.map((n: any) => ({
         ...n,
         draggable: true,
      }));

      const polishedEdges = data.edges.map((e: any) => ({
         ...e,
         animated: true,
         style: { stroke: '#4b5563', strokeWidth: 2 },
         markerEnd: { type: MarkerType.ArrowClosed, color: '#4b5563' },
      }));

      setNodes(polishedNodes);
      setEdges(polishedEdges);
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

  if (!nodes?.length && !loading) {
    return <EmptyCanvas />;
  }

  return (
    <div className="w-full h-full bg-transparent relative overflow-hidden flex flex-col">
      <CanvasErrorBoundary>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          className="w-full h-full"
        >
          <Background gap={32} color="rgba(255,255,255,0.03)" variant={BackgroundVariant.Dots} />
        </ReactFlow>
      </CanvasErrorBoundary>

      <AnimatePresence>
        {loading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-[#0F1115]/50 backdrop-blur-sm"
          >
            <div className="flex flex-col items-center gap-6">
              <div className="relative">
                <Brain size={48} className="text-violet-500 animate-pulse" />
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                  className="absolute inset-[-12px] border-2 border-dashed border-violet-500/20 rounded-full"
                />
              </div>
              <span className="text-violet-400 font-black text-[10px] tracking-[0.3em] uppercase translate-x-1">Connecting Neural Graph...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
