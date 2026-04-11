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
        className="w-full h-32 resize-none bg-transparent px-8 py-7 text-xl text-zinc-100 placeholder:text-zinc-600 outline-none leading-relaxed transition-all font-sans"
      />

      <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.04] bg-white/[0.01]">
         <div className="flex items-center gap-3">
            <button onClick={toggleAppLauncher} className="p-2.5 rounded-xl hover:bg-white/5 text-zinc-500 hover:text-zinc-300 transition-all cursor-pointer"><Plus size={20} /></button>
            <button onClick={toggleDashboard} className="p-2.5 rounded-xl hover:bg-white/5 text-zinc-500 hover:text-zinc-300 transition-all cursor-pointer"><Monitor size={20} /></button>
            <button onClick={toggleSearchView} className="p-2.5 rounded-xl hover:bg-white/5 text-zinc-500 hover:text-zinc-300 transition-all cursor-pointer"><Globe size={20} /></button>
         </div>
         <div className="flex items-center gap-4">
            <button onClick={onMicClick} className={`p-2.5 rounded-xl transition-all ${isRecording ? 'bg-red-500/10 text-red-500' : 'hover:bg-white/5 text-zinc-500 hover:text-zinc-300'}`}><Mic size={20} className={isRecording ? 'animate-pulse' : ''} /></button>
            <button 
              onClick={() => onSubmit()} 
              disabled={!draft.trim()} 
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-violet-600 text-white shadow-lg shadow-violet-600/20 transition-all hover:scale-110 active:scale-95 disabled:opacity-30 disabled:grayscale cursor-pointer"
            >
              <ArrowUp size={20} />
            </button>
         </div>
      </div>
    </motion.div>
  );
}
