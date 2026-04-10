'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Monitor, Globe, FileText, Mic, ArrowUp } from 'lucide-react';
import { useRef, useEffect } from 'react';

interface CommandInputProps {
  draft: string;
  setDraft: (v: string) => void;
  isFocused: boolean;
  setFocused: (v: boolean) => void;
  isDragging: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onSubmit: (textOverride?: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onMicClick: () => void;
  isRecording: boolean;
  placeholder: string;
  detectedMode: string;
  previewAgents: string[];
  activeSuggestions: any[];
  toggleAppLauncher: () => void;
  toggleDashboard: () => void;
  toggleSearchView: () => void;
  toggleLibraryView: () => void;
}

export function CommandInput({
  draft, setDraft, isFocused, setFocused, isDragging, onDragOver, onDragLeave, onDrop,
  onSubmit, onKeyDown, onMicClick, isRecording, placeholder, detectedMode, previewAgents,
  activeSuggestions, toggleAppLauncher, toggleDashboard, toggleSearchView, toggleLibraryView
}: CommandInputProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isFocused) inputRef.current?.focus();
  }, [isFocused]);

  return (
    <motion.div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      animate={{
        boxShadow: isFocused 
          ? '0 0 0 1px rgba(139, 92, 246, 0.5), 0 30px 60px rgba(139, 92, 246, 0.2)' 
          : '0 30px 60px rgba(0,0,0, 0.6)',
        scale: isDragging ? 1.02 : 1,
        borderColor: isDragging ? 'rgba(139, 92, 246, 0.6)' : isFocused ? 'rgba(139, 92, 246, 0.4)' : 'rgba(39, 39, 42, 0.6)',
      }}
      className={`w-full rounded-[28px] bg-zinc-900/30 border border-zinc-800/50 overflow-hidden backdrop-blur-3xl transition-all duration-500 relative ${isDragging ? 'bg-violet-500/10' : ''}`}
    >
      {isDragging && (
        <div className="absolute inset-0 flex items-center justify-center bg-violet-500/10 backdrop-blur-sm z-50 pointer-events-none">
          <div className="flex flex-col items-center gap-2 text-violet-400">
            <Plus size={32} className="animate-bounce" />
            <span className="text-sm font-bold uppercase tracking-wider">Drop to Analyze Content</span>
          </div>
        </div>
      )}

      <textarea
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 200)}
        placeholder={placeholder}
        className="w-full h-24 resize-none bg-transparent px-6 py-5 text-lg text-zinc-100 placeholder:text-zinc-600 outline-none leading-relaxed transition-all font-sans"
      />

      <AnimatePresence>
        {draft.trim().length > 3 && isFocused && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mx-6 mb-4 p-4 rounded-2xl bg-violet-600/5 border border-violet-500/20 flex items-center justify-between"
          >
             <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                   <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                      detectedMode === 'developer' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                      detectedMode === 'founder' ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400' :
                      'bg-violet-500/10 border-violet-500/20 text-violet-400'
                   }`}>
                      {detectedMode} mode detected
                   </span>
                </div>
                <div className="flex items-center gap-2">
                   {previewAgents.map((agent, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                         <div className="w-1.5 h-1.5 rounded-full bg-violet-500/40" />
                         <span className="text-[10px] text-zinc-400 font-medium">{agent}</span>
                      </div>
                   ))}
                </div>
             </div>
             <div className="flex items-center gap-2 text-[10px] font-bold text-violet-400 uppercase tracking-tighter animate-pulse">
                <ArrowUp size={12} /> Press Enter to deploy
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800/40 bg-zinc-950/20">
         <div className="flex items-center gap-2">
            <button onClick={toggleAppLauncher} className="p-2 rounded-full hover:bg-zinc-800 text-zinc-500 transition-colors"><Plus size={18} /></button>
            <div className="h-4 w-px bg-zinc-800/60 mx-1" />
            <button onClick={toggleDashboard} className="p-2 rounded-full hover:bg-zinc-800 text-zinc-500 transition-colors"><Monitor size={18} /></button>
            <button onClick={toggleSearchView} className="p-2 rounded-full hover:bg-zinc-800 text-zinc-500 transition-colors"><Globe size={18} /></button>
            <button onClick={toggleLibraryView} className="p-2 rounded-full hover:bg-zinc-800 text-zinc-500 transition-colors"><FileText size={18} /></button>
         </div>
         <div className="flex items-center gap-3">
            <button onClick={onMicClick} className={`p-2 rounded-full transition-colors group ${isRecording ? 'bg-red-500/10 text-red-500' : 'hover:bg-zinc-800 text-zinc-500'}`}><Mic size={18} className={isRecording ? 'animate-pulse' : ''} /></button>
            <button onClick={() => onSubmit()} disabled={!draft.trim()} className="p-2 rounded-full bg-gradient-to-r from-violet-600 to-cyan-600 text-white shadow-[0_0_15px_rgba(139,92,246,0.4)] transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:grayscale"><ArrowUp size={18} /></button>
         </div>
      </div>
    </motion.div>
  );
}
