'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Type, 
  Bold, 
  Italic, 
  List, 
  Image as ImageIcon, 
  Link as LinkIcon, 
  Save, 
  Share2, 
  X, 
  Maximize2, 
  Minimize2,
  Sparkles,
  ChevronDown
} from 'lucide-react';

export function DocumentEditor({ 
  initialContent, 
  title, 
  onClose, 
  onSave 
}: { 
  initialContent: string, 
  title: string, 
  onClose: () => void, 
  onSave: (content: string) => void 
}) {
  const [content, setContent] = useState(initialContent);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      onSave(content);
      setIsSaving(false);
    }, 1000);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`fixed z-[130] bg-[#070514] border border-zinc-800 shadow-2xl flex flex-col overflow-hidden transition-all duration-500 ${
          isFullscreen 
            ? 'inset-0 rounded-0' 
            : 'inset-12 md:inset-20 rounded-[40px]'
        }`}
      >
        {/* Toolbar */}
        <header className="px-8 py-4 border-b border-zinc-800/60 bg-zinc-900/20 flex items-center justify-between backdrop-blur-xl">
          <div className="flex items-center gap-6">
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-500 transition-colors">
              <X size={20} />
            </button>
            <div className="flex flex-col">
               <h2 className="text-sm font-bold text-zinc-100">{title}</h2>
               <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                  <span>Draft</span>
                  <span className="w-1 h-1 rounded-full bg-zinc-800" />
                  <span>Last edited 2m ago</span>
               </div>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-zinc-950/50 p-1.5 rounded-2xl border border-zinc-800/80">
            {[Bold, Italic, List, LinkIcon, ImageIcon].map((Icon, i) => (
              <button key={i} className="p-2.5 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all">
                <Icon size={16} />
              </button>
            ))}
            <div className="w-px h-6 bg-zinc-800 mx-1" />
            <button className="flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-600/10 text-violet-400 text-xs font-bold hover:bg-violet-600/20 transition-all">
              <Sparkles size={14} /> AI Rewrite
            </button>
          </div>

          <div className="flex items-center gap-3">
             <button 
               onClick={() => setIsFullscreen(!isFullscreen)}
               className="p-3 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white transition-all shadow-lg"
             >
               {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
             </button>
             <button 
               onClick={handleSave}
               className={`px-6 py-2.5 rounded-xl bg-violet-600 text-white font-bold text-sm shadow-xl shadow-violet-600/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
             >
               {isSaving ? 'Saving...' : 'Save Changes'}
               <Save size={16} />
             </button>
          </div>
        </header>

        {/* Editor Area */}
        <div className="flex-1 overflow-y-auto bg-zinc-950/20 flex justify-center p-8 md:p-20 custom-scrollbar">
           <div className="w-full max-w-3xl">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Start writing or use AI to generate content..."
                className="w-full h-full bg-transparent border-none text-zinc-100 text-lg leading-relaxed placeholder:text-zinc-800 outline-none resize-none font-serif selection:bg-violet-600/30"
              />
           </div>
        </div>

        {/* Stats */}
        <footer className="px-10 py-3 bg-zinc-950/60 border-t border-zinc-800/40 flex items-center justify-between text-[10px] font-black uppercase tracking-[.2em] text-zinc-600">
           <div className="flex items-center gap-8">
              <span>{content.split(/\s+/).filter(x => x).length} Words</span>
              <span>{content.length} Characters</span>
              <span>Reading time: {Math.max(1, Math.round(content.split(/\s+/).length / 200))} min</span>
           </div>
           <div className="flex items-center gap-2 text-violet-400">
              <Sparkles size={12} />
              AI Assistance Optimized
           </div>
        </footer>
      </motion.div>
    </AnimatePresence>
  );
}
