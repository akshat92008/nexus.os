import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNexusStore } from '../../store/nexusStore';
import { Library, Folder, Clock, Target, Database, Zap, FileText, ChevronRight, X, Sparkles } from 'lucide-react';

export function LibraryView() {
  const { ui, workspaces, toggleLibraryView, setActiveWorkspace } = useNexusStore();
  const [filterType, setFilterType] = React.useState('All');
  
  const history = Object.values(workspaces)
    .filter(ws => filterType === 'All' || ws.goalType === filterType.toLowerCase().replace(' ', '_'))
    .sort((a, b) => b.createdAt - a.createdAt);

  if (!ui.libraryViewOpen) return null;

  const handleSelect = (id: string) => {
    setActiveWorkspace(id);
    toggleLibraryView();
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'lead_gen': return <Target size={18} className="text-emerald-400" />;
      case 'research': return <Database size={18} className="text-cyan-400" />;
      case 'strategy': return <Zap size={18} className="text-violet-400" />;
      default: return <FileText size={18} className="text-zinc-500" />;
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] grid place-items-center bg-[#070514]/80 backdrop-blur-md p-4"
        onClick={toggleLibraryView}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-5xl bg-[#0f0c29] border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-8 border-b border-white/5 bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-violet-500/20 text-violet-400 border border-violet-500/30">
                <Library size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">Mission Library</h2>
                <p className="text-sm text-slate-400">Stored intelligence, records, and neural artifacts</p>
              </div>
            </div>
            <button
              onClick={toggleLibraryView}
              className="p-2.5 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          <div className="flex">
            {/* Sidebar Filters */}
            <div className="w-64 border-r border-white/5 p-6 bg-[#0B0914] shrink-0">
               <div className="space-y-4">
                 <div>
                   <h4 className="text-[10px] uppercase font-black text-slate-600 mb-3 tracking-widest pl-2">Filter By Type</h4>
                   <div className="space-y-1">
                     {['All', 'Lead Gen', 'Research', 'Strategy', 'Content'].map(t => (
                       <button 
                         key={t} 
                         onClick={() => setFilterType(t)}
                         className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${filterType === t ? 'bg-violet-600/10 text-violet-400' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                       >
                         <div className="flex items-center gap-3">
                            <Folder size={14} className={filterType === t ? 'text-violet-400' : 'text-slate-600'} />
                            {t}
                         </div>
                       </button>
                     ))}
                   </div>
                 </div>

                 <div className="pt-6">
                   <h4 className="text-[10px] uppercase font-black text-slate-600 mb-3 tracking-widest pl-2">Intelligence Vault</h4>
                   <div className="p-4 rounded-2xl bg-violet-600/10 border border-violet-500/10">
                     <p className="text-xs text-slate-400 leading-relaxed">Your library synchronizes across all Agentic OS instances on this device.</p>
                     <div className="mt-3 flex items-center gap-2 text-[10px] text-violet-400 font-bold uppercase tracking-widest">
                       <Sparkles size={12} /> Sync Active
                     </div>
                   </div>
                 </div>
               </div>
            </div>

            {/* Grid Area */}
            <div className="flex-1 p-8 bg-[#0B0914] max-h-[600px] overflow-y-auto custom-scrollbar">
               {history.length === 0 ? (
                 <div className="flex flex-col items-center justify-center py-20 text-slate-500 text-center">
                    <Folder size={48} className="mb-4 opacity-10" />
                    <p className="text-lg font-bold text-white">No Record Data</p>
                    <p className="text-sm mt-1 max-w-[280px]">Missions will appear here as soon as they are deployed and saved.</p>
                 </div>
               ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {history.map(ws => (
                      <button
                        key={ws.id}
                        onClick={() => handleSelect(ws.id)}
                        className="group flex flex-col items-start p-6 rounded-2xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.04] hover:border-violet-500/20 transition-all text-left"
                      >
                         <div className="flex items-center justify-between w-full mb-4">
                           <div className="p-3 rounded-xl bg-zinc-900 border border-white/10">
                             {getIcon(ws.goalType)}
                           </div>
                           <ChevronRight size={20} className="text-slate-700 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1" />
                         </div>
                         
                         <h3 className="text-lg font-bold text-white mb-2 leading-snug group-hover:text-violet-400 transition-colors">
                            {ws.goal.length > 50 ? ws.goal.slice(0, 50) + '...' : ws.goal}
                         </h3>
                         
                         <div className="mt-auto w-full pt-4 border-t border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                              <Clock size={12} /> {new Date(ws.createdAt).toLocaleDateString()}
                            </div>
                            <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-slate-400">{ws.sections.length} Sections</span>
                         </div>
                      </button>
                    ))}
                 </div>
               )}
            </div>
          </div>
          
          {/* Footer */}
          <div className="p-4 border-t border-white/5 bg-[#0f0c29] flex items-center justify-between text-[11px] text-slate-500 font-medium">
             <div className="flex items-center gap-4">
               <span>OS Vault Protocol: Encrypted</span>
               <span>Storage: {history.length} Neural Mission Logs</span>
             </div>
             <div className="flex items-center gap-2">
               <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
               Agentic OS Library v1.0
             </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
