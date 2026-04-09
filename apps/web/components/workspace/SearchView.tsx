import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNexusStore } from '../../store/nexusStore';
import { Search, X, Command, CornerDownLeft, Target, Database, Zap, FileText } from 'lucide-react';

export function SearchView() {
  const { ui, workspaces, toggleSearchView, setActiveWorkspace } = useNexusStore();
  const [query, setQuery] = useState('');
  
  if (!ui.searchViewOpen) return null;

  const results = Object.values(workspaces).filter(ws => 
    ws.goal.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 5);

  const handleSelect = (id: string) => {
    setActiveWorkspace(id);
    toggleSearchView();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') toggleSearchView();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSearchView]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'lead_gen': return <Target size={14} className="text-emerald-400" />;
      case 'research': return <Database size={14} className="text-cyan-400" />;
      case 'strategy': return <Zap size={14} className="text-violet-400" />;
      default: return <FileText size={14} className="text-zinc-500" />;
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[110] grid place-items-center bg-[#070514]/90 backdrop-blur-xl p-4"
        onClick={toggleSearchView}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: -20 }}
          className="relative w-full max-w-2xl bg-[#121021] border border-white/10 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search Box */}
          <div className="flex items-center gap-4 p-6 border-b border-white/5">
            <Search className="text-violet-400" size={24} />
            <input 
              autoFocus
              type="text"
              placeholder="Search missions, artifacts, or intelligence..."
              className="flex-1 bg-transparent border-none text-xl text-white placeholder-slate-600 focus:outline-none focus:ring-0"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-white/5 border border-white/10 text-[10px] text-slate-500 font-bold">
              <Command size={10} /> <span>K</span>
            </div>
          </div>

          {/* Results Area */}
          <div className="p-4 bg-[#0B0914] min-h-[300px]">
             {query && results.length > 0 ? (
               <div className="space-y-1">
                 <div className="px-3 mb-2 text-[10px] uppercase tracking-widest text-slate-500 font-black">Top Workspace Matches</div>
                 {results.map(rs => (
                   <button
                     key={rs.id}
                     onClick={() => handleSelect(rs.id)}
                     className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-white/[0.04] group transition-all text-left"
                   >
                     <div className="flex items-center gap-4">
                       <div className="p-2.5 rounded-lg bg-zinc-900 border border-white/5">
                         {getIcon(rs.goalType)}
                       </div>
                       <div>
                         <div className="text-sm font-semibold text-white group-hover:text-violet-300 transition-colors">{rs.goal}</div>
                         <div className="text-[10px] text-slate-500 mt-0.5">{new Date(rs.createdAt).toLocaleDateString()} • {rs.sections.length} Sections Deployed</div>
                       </div>
                     </div>
                     <CornerDownLeft size={14} className="text-slate-700 opacity-0 group-hover:opacity-100 transition-all" />
                   </button>
                 ))}
               </div>
             ) : query ? (
               <div className="flex flex-col items-center justify-center pt-12 text-slate-500">
                 <Search size={40} className="mb-4 opacity-10" />
                 <p className="text-sm">No neural matches found for "{query}"</p>
                 <p className="text-xs mt-1 border-stone-800">Try searching for a specific goal or mission type.</p>
               </div>
             ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                    <h4 className="text-[10px] uppercase font-black text-slate-600 mb-3 tracking-widest pl-1">Recent Activity</h4>
                    <div className="space-y-2">
                       {Object.values(workspaces).slice(0, 3).map(ws => (
                         <div key={ws.id} className="text-[11px] text-slate-400 truncate hover:text-violet-400 cursor-pointer" onClick={() => handleSelect(ws.id)}>
                            {ws.goal}
                         </div>
                       ))}
                       {Object.values(workspaces).length === 0 && (
                         <div className="text-[10px] text-slate-600 italic">No recent activity</div>
                       )}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                    <h4 className="text-[10px] uppercase font-black text-slate-600 mb-3 tracking-widest pl-1">Global Graph</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold uppercase">
                        <span>Deployed</span>
                        <span className="text-zinc-400">{Object.values(workspaces).length}</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold uppercase">
                        <span>Sessions</span>
                        <span className="text-zinc-400">{Object.values(workspaces).length}</span>
                      </div>
                    </div>
                  </div>
                </div>
             )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-600 font-medium">
             <div className="flex items-center gap-3">
               <span>ESC to close</span>
               <span>↑↓ to navigate</span>
               <span>ENTER to select</span>
             </div>
             <div className="flex items-center gap-2">
               <span className="w-1 h-1 rounded-full bg-emerald-500" />
               Agentic Search UI v1.0
             </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
