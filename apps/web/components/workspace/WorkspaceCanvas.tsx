'use client';

import { useNexusStore } from '../../store/nexusStore';
import { useModeStore } from '../../store/modeStore';
import { useNexusSSE } from '../../hooks/useNexusSSE';
import { DocumentSection } from './sections/DocumentSection';
import { TableSection } from './sections/TableSection';
import { TaskSection } from './sections/TaskSection';
import { ProjectBoard } from './ProjectBoard';
import { 
  Lightbulb, FileText, FileSpreadsheet, Download, FileJson, X, Kanban,
  Search, Globe, Zap, TrendingUp, Target
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { WorkspaceSection, ExportFormat } from '@nexus-os/types';
import { exportArtifact } from '../../lib/exportArtifact';
import { useState, useCallback } from 'react';
import React from 'react';

class CanvasErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('[WorkspaceCanvas] Render error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-zinc-600">
            <p className="text-zinc-400 text-sm mb-1">Workspace render error</p>
            <p className="text-xs">Your mission is still running in the background</p>
            <button
              className="mt-3 text-xs text-violet-400 hover:text-violet-300 underline"
              onClick={() => this.setState({ hasError: false })}
            >
              Reload canvas
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function EmptyWorkspace() {
  return (
    <div className="flex h-full items-center justify-center px-6 py-12">
      <div className="text-center text-zinc-400 max-w-md">
        <p className="text-lg font-semibold text-white mb-2">No workspace selected</p>
        <p className="text-sm text-zinc-500">Start a new mission or select an existing workspace to get started.</p>
      </div>
    </div>
  );
}

function renderSection(workspaceId: string, section: WorkspaceSection) {
  switch (section.type) {
    case 'document':
      return <DocumentSection key={section.id} workspaceId={workspaceId} section={section} />;
    case 'table':
      return <TableSection key={section.id} workspaceId={workspaceId} section={section} />;
    case 'tasklist':
      return <TaskSection key={section.id} workspaceId={workspaceId} section={section} />;
    case 'kanban':
      return (
        <div key={section.id} className="rounded-[40px] border border-zinc-800 bg-zinc-900/20 mb-12 overflow-hidden shadow-2xl">
           <div className="px-8 pt-8 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-zinc-800 text-violet-400">
                 <Kanban size={18} />
              </div>
              <div>
                 <h3 className="font-bold text-zinc-100 uppercase tracking-widest text-[11px]">{section.title}</h3>
                 <p className="text-xs text-zinc-500 font-medium">{section.description || 'Project organization'}</p>
              </div>
           </div>
           <ProjectBoard workspaceId={workspaceId} sectionId={section.id} tasks={section.content} />
        </div>
      );
    case 'insight':
      // specialized inline insight renderer
      return (
        <div key={section.id} className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded bg-violet-500/20 flex items-center justify-center text-violet-400">
              <Lightbulb size={16} />
            </div>
            <div>
              <h3 className="font-semibold text-zinc-100">{section.title}</h3>
              {section.description && <p className="text-sm text-zinc-400 mt-1">{section.description}</p>}
            </div>
          </div>
          <div className={`grid gap-4 mt-6 ${section.title?.includes('SWOT') ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 md:grid-cols-2'}`}>
            {section.content?.map((insight: any, i: number) => {
              // Extract category from SWOT insight if present (e.g., "STRENGHTS: ...")
              const isSwot = section.title?.includes('SWOT');
              const parts = insight.insight.split(': ');
              const category = isSwot && parts.length > 1 ? parts[0] : null;
              const text = isSwot && parts.length > 1 ? parts[1] : insight.insight;

              return (
                <div key={i} className={`flex flex-col gap-2 p-4 rounded-lg bg-zinc-950/50 border ${category === 'STRENGTHS' ? 'border-emerald-500/20' : category === 'WEAKNESSES' ? 'border-rose-500/20' : category === 'OPPORTUNITIES' ? 'border-sky-500/20' : category === 'THREATS' ? 'border-amber-500/20' : 'border-zinc-800/80'}`}>
                  {category && (
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${category === 'STRENGTHS' ? 'text-emerald-400' : category === 'WEAKNESSES' ? 'text-rose-400' : category === 'OPPORTUNITIES' ? 'text-sky-400' : category === 'THREATS' ? 'text-amber-400' : 'text-zinc-500'}`}>
                      {category}
                    </span>
                  )}
                  <div className="flex gap-4">
                    {!category && <div className={`shrink-0 w-1.5 rounded-full ${insight.confidence === 'high' ? 'bg-emerald-500' : 'bg-amber-500'}`} />}
                    <p className="text-sm text-zinc-300 leading-relaxed font-medium">{text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    default:
      return (
        <div key={section.id} className="p-4 border border-zinc-800 rounded bg-zinc-900/50 mb-4 text-sm text-zinc-500">
          Unrecognized section type: {section.type}
        </div>
      );
  }
}

export function WorkspaceCanvas() {
  const activeId = useNexusStore(s => s.activeWorkspaceId);
  const workspaces = useNexusStore(s => s.workspaces);
  const sessionId = useNexusStore(s => s.session.id);
  const userId = useNexusStore(s => s.session.userId);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [showSimulatedBanner, setShowSimulatedBanner] = useState(true);

  const { currentMode } = useModeStore();
  const { startOrchestration } = useNexusSSE();

  const isSimulated = process.env.NEXT_PUBLIC_SEARCH_MODE === 'simulated';

  const FOUNDER_QUICK_ACTIONS = [
    { text: 'Find Leads', icon: Search, action: 'lead_gen' },
    { text: 'Analyze Rivals', icon: Globe, action: 'competitor_analysis' },
    { text: 'SWOT Analysis', icon: TrendingUp, action: 'swot_analysis' },
    { text: 'Product Roadmap', icon: Target, action: 'product_strategy' },
  ];

  const isStudent = currentMode === 'student';

  const handleRefine = useCallback(async (instruction: string) => {
    if (!activeId || !userId) return;
    const ws = workspaces[activeId];
    const newGoal = `${instruction} (Context: ${ws.goal})`;
    await startOrchestration(newGoal, userId, currentMode);
  }, [activeId, userId, workspaces, startOrchestration, currentMode]);

  if (!activeId) return <EmptyWorkspace />;
  const workspace = workspaces[activeId];
  if (!workspace) return <EmptyWorkspace />;

  const handleGlobalExport = async (format: ExportFormat) => {
    // For workspace-wide export, we use the session ID linked to the mission
    // In a real app, we'd lookup the sessionId from the workspace metadata
    const sid = sessionId || workspace.id; 
    setExporting(format);
    try {
      await exportArtifact(sid, format);
    } catch (err) {
      console.error('Export failed', err);
    } finally {
      setExporting(null);
    }
  };

  return (
    <CanvasErrorBoundary>
      <div className="flex-1 w-full h-full space-y-6 pb-12 fade-in overflow-y-auto custom-scrollbar px-2">
      {isSimulated && showSimulatedBanner && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center justify-between backdrop-blur-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500">
              <AlertCircle size={16} />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-200">Simulated Search Mode Active</p>
              <p className="text-xs text-amber-500/80 font-medium">Web results are currently generated by the brain for testing. Live Tavily search is disabled.</p>
            </div>
          </div>
          <button 
            onClick={() => setShowSimulatedBanner(false)}
            className="p-2 hover:bg-white/5 rounded-lg text-amber-500/50 hover:text-amber-500 transition-colors"
          >
            <X size={16} />
          </button>
        </motion.div>
      )}

      {/* Workspace Header */}
      <div className="mb-10 mt-4 border-b border-zinc-800/80 pb-6">
        <div className="flex items-center gap-2 text-xs font-medium text-violet-400 mb-3 bg-violet-400/10 w-max px-2.5 py-1 rounded-md uppercase tracking-widest">
          {currentMode === 'founder' ? 'Strategic Workspace' : currentMode === 'developer' ? 'Code Studio' : 'Learning Workspace'}
        </div>
        <h2 className="text-3xl font-bold tracking-tight text-white mb-2">{workspace.goal}</h2>
        <div className="flex items-center gap-4 text-xs text-zinc-500 font-mono">
          <span>ID: {workspace.id.split('-')[0]}</span>
          <span>•</span>
          <span>{new Date(workspace.createdAt).toLocaleString()}</span>
        </div>
      </div>



      {/* Founder Refinement Micro-actions */}
      {currentMode === 'founder' && (
        <div className="flex items-center gap-3 mb-10 p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-sm">
          <div className="text-xs font-bold uppercase tracking-widest text-zinc-500 pr-2 border-r border-zinc-800">Strategy</div>
          <button 
            onClick={() => handleRefine('Find 10 more high-quality B2B leads for this market.')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold hover:bg-emerald-600 hover:text-white transition-all"
          >
            <Search size={14} /> Find Leads
          </button>
          <button 
            onClick={() => handleRefine('Analyze the top 3 competitors in this niche deeply.')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold hover:bg-cyan-600 hover:text-white transition-all"
          >
            <Globe size={14} /> Analyze Rivals
          </button>
        </div>
      )}

      {/* Developer Refinement Micro-actions */}
      {currentMode === 'developer' && (
        <div className="flex items-center gap-3 mb-10 p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-sm">
          <div className="text-xs font-bold uppercase tracking-widest text-zinc-500 pr-2 border-r border-zinc-800">Engineering</div>
          <button 
            onClick={() => handleRefine('Optimize this code for performance and readability.')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600/10 border border-violet-500/30 text-violet-400 text-xs font-bold hover:bg-violet-600 hover:text-white transition-all"
          >
            <Zap size={14} /> Optimize
          </button>
          <button 
            onClick={() => handleRefine('Add comprehensive docblocks and comments to this code.')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600/10 border border-blue-500/30 text-blue-400 text-xs font-bold hover:bg-blue-600 hover:text-white transition-all"
          >
            <FileText size={14} /> Add Comments
          </button>
        </div>
      )}

      {/* Student Refinement Micro-actions */}
      {isStudent && (
        <div className="flex items-center gap-3 mb-10 p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-sm">
          <div className="text-xs font-bold uppercase tracking-widest text-zinc-500 pr-2 border-r border-zinc-800">Learning</div>
          <button 
            onClick={() => handleRefine('Explain this topic much simpler, like I am 10 years old.')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600/10 border border-violet-500/30 text-violet-400 text-xs font-bold hover:bg-violet-600 hover:text-white transition-all"
          >
            <Lightbulb size={14} /> Explain Simpler
          </button>
          <button 
            onClick={() => handleRefine('Make this explanation much shorter and more concise.')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold hover:bg-cyan-600 hover:text-white transition-all"
          >
            <FileText size={14} /> Make Shorter
          </button>
          <button 
            onClick={() => handleRefine('Generate 5 more difficult mock exam questions for this.')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600/10 border border-amber-500/30 text-amber-400 text-xs font-bold hover:bg-amber-600 hover:text-white transition-all"
          >
            <Download size={14} /> Harder Questions
          </button>
        </div>
      )}

      {/* Sections */}
      <div className="flex flex-col gap-8">
        {workspace.sections.map(sec => renderSection(workspace.id, sec))}
      </div>
      </div>
    </CanvasErrorBoundary>
  );
}
