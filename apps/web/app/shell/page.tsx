'use client';

import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Loader2 } from 'lucide-react';
import { MissionTracker, MissionData } from '@/components/shell/MissionTracker';

export default function CommandPilot() {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [missionHistory, setMissionHistory] = useState<MissionData[]>([]);
  const [activeHistoryItem, setActiveHistoryItem] = useState<MissionData | null>(null);
  const [isActive, setIsActive] = useState(false); 
  const inputRef = useRef<HTMLInputElement>(null);

  // Toggle active/passive mode in Tauri based on local state or global shortcuts
  useEffect(() => {
    const handleFocus = () => {
      setIsActive(true);
      invoke('toggle_gateway', { active: true });
    };

    const handleBlur = () => {
      if (!isProcessing && !input) {
         setIsActive(false);
         invoke('toggle_gateway', { active: false });
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.metaKey && e.shiftKey && e.code === 'Space') {
            const nextState = !isActive;
            setIsActive(nextState);
            invoke('toggle_gateway', { active: nextState });
            if (nextState) inputRef.current?.focus();
        }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
       window.removeEventListener('focus', handleFocus);
       window.removeEventListener('blur', handleBlur);
       window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isActive, isProcessing, input]);
  
  const handleExecute = async () => {
    if (!input.trim() || isProcessing) return;

    const missionText = input.trim();
    setInput('');
    setIsProcessing(true);
    setActiveHistoryItem(null); 
    
    setIsActive(true);
    invoke('toggle_gateway', { active: true });

    try {
      const finalResult: any = await invoke('execute_mission', {
        message: missionText,
        sessionId: 'native-session-001',
        history: [] 
      });

      if (finalResult && finalResult.mission) {
         setMissionHistory(prev => [{
            mission: finalResult.mission,
            plan: finalResult.plan || [],
            current_step: finalResult.current_step || 0,
            status: finalResult.status || 'completed'
         }, ...prev]);
      }
    } catch (err: any) {
      console.error("Mission execution failed", err);
    } finally {
      setIsProcessing(false);
      setTimeout(() => {
         if (!inputRef.current?.value) {
            setIsActive(false);
            invoke('toggle_gateway', { active: false });
         }
      }, 3000);
    }
  };

  return (
    <div className={`h-screen w-screen flex flex-col items-center justify-center bg-transparent transition-all duration-300 pointer-events-none`}>
      <AnimatePresence mode="wait">
        {(isActive || isProcessing || input) && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-2xl pointer-events-auto"
          >
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl blur opacity-50 group-focus-within:opacity-100 transition duration-1000" />
              <div className="relative bg-[#0a0a0a]/80 backdrop-blur-2xl border border-white/10 rounded-2xl flex items-center p-2 shadow-2xl">
                <Terminal className="text-blue-400 ml-3" size={24} />
                <input 
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                          handleExecute();
                      }
                  }}
                  className="flex-grow bg-transparent border-none focus:outline-none focus:ring-0 text-white px-4 py-4 text-xl placeholder:text-white/20"
                  placeholder="Assign a mission to Nexus OS..."
                  autoFocus
                />
                <div className="flex items-center gap-3 mr-3 cursor-pointer" onClick={handleExecute}>
                  <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest leading-tight">Cmd +<br/>Enter</span>
                  <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold hover:bg-blue-500 transition">
                    {isProcessing ? <Loader2 className="animate-spin" size={16} /> : '🚀'}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mission Tracker UI */}
        <AnimatePresence>
           {(isProcessing || activeHistoryItem) && (
              <motion.div 
                 initial={{ opacity: 0, y: -20 }}
                 animate={{ opacity: 1, y: 10 }}
                 exit={{ opacity: 0, y: -20 }}
                 className="mt-4 bg-[#0a0a0a]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl pointer-events-auto"
              >
                  <MissionTracker />
              </motion.div>
           )}
        </AnimatePresence>

      </div>
  );
}
