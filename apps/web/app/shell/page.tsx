'use client';

import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Terminal, Loader2, History, ChevronRight, BellRing } from 'lucide-react';
import { StatusHud } from '@/components/shell/StatusHud';
import { MissionTracker, MissionData } from '@/components/shell/MissionTracker';

export default function CyberShell() {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [missionHistory, setMissionHistory] = useState<MissionData[]>([]);
  const [activeHistoryItem, setActiveHistoryItem] = useState<MissionData | null>(null);
  const [inboxToast, setInboxToast] = useState<{message: string} | null>(null);

  useEffect(() => {
    const unlisten = listen('nexus-inbox-event', (event: any) => {
      setInboxToast({ message: event.payload.message || 'New file detected in NexusInbox' });
      const timer = setTimeout(() => setInboxToast(null), 8000);
      return () => clearTimeout(timer);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);
  
  const handleExecute = async () => {
    if (!input.trim() || isProcessing) return;

    const missionText = input.trim();
    setInput('');
    setIsProcessing(true);
    setActiveHistoryItem(null); // Return to active tracker view

    try {
      // Call Rust Backend -> It will emit 'mission-update' events dynamically
      const finalResult: any = await invoke('execute_mission', {
        message: missionText,
        sessionId: 'native-session-001',
        history: [] 
      });

      // Once finished, save the final mission structure to history
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
    }
  };

  return (
    <div className="flex h-screen bg-[#050505] text-white font-sans selection:bg-blue-500/30">
      {/* Sidebar HUD */}
      <StatusHud 
        brainStatus="online" 
        nerveStatus={isProcessing ? 'reconnecting' : 'connected'} 
        currentAgent={isProcessing ? 'Executing...' : 'READY'}
      />

      {/* Main Command Center */}
      <main className="flex-grow flex flex-col relative overflow-hidden">
        {/* Glass Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full" />
        </div>

        {/* Global Toast Overlay */}
        <AnimatePresence>
          {inboxToast && (
            <motion.div
              initial={{ opacity: 0, y: -50, scale: 0.9 }}
              animate={{ opacity: 1, y: 16, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute top-0 left-1/2 -translate-x-1/2 z-50 pointer-events-auto"
            >
              <div className="bg-[#0a0a0a] border border-blue-500/30 p-4 rounded-xl shadow-2xl flex items-center space-x-4">
                <BellRing className="text-blue-400 animate-pulse" size={24} />
                <span className="text-white/90 text-sm font-semibold">{inboxToast.message}</span>
                <button 
                  onClick={() => setInboxToast(null)}
                  className="text-white/40 hover:text-white px-2"
                >
                   ✕
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <header className="h-16 shrink-0 border-b border-white/5 flex items-center px-8 z-10">
          <div className="flex items-center space-x-3">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <h1 className="text-sm font-bold tracking-[0.2em] text-white/80 uppercase">Nerve Engine // Mission Control</h1>
          </div>
        </header>

        {/* Content Area: Two Panes */}
        <div className="flex flex-1 overflow-hidden z-10 mt-4">
          
          {/* Left Pane: Mission History Sidebar */}
          <aside className="w-1/3 max-w-[300px] border-r border-white/5 flex flex-col p-4 overflow-y-auto">
            <div className="flex items-center space-x-2 text-white/50 mb-4 px-2 tracking-widest text-xs uppercase font-bold">
               <History size={16} />
               <span>Mission History</span>
            </div>
            
            <div className="flex flex-col space-y-2">
              {missionHistory.length === 0 ? (
                <div className="text-white/20 text-xs px-2 italic">No previous missions.</div>
              ) : (
                missionHistory.map((hist, idx) => (
                  <button 
                    key={idx}
                    onClick={() => setActiveHistoryItem(hist)}
                    className="flex justify-between items-center text-left p-3 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-colors text-sm"
                  >
                    <span className="truncate pr-2 font-semibold text-white/80">{hist.mission}</span>
                    <ChevronRight size={14} className="text-white/30 shrink-0" />
                  </button>
                ))
              )}
            </div>
          </aside>

          {/* Right Pane: Mission Tracker OR History Details */}
          <div className="flex-1 flex flex-col p-4 relative">
             {activeHistoryItem ? (
                // View Past Mission
                <div className="flex-grow overflow-y-auto w-full max-w-4xl mx-auto space-y-6">
                   <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-4">
                     <h2 className="text-xl font-bold text-white tracking-wide mb-2 flex items-center gap-3">
                        <span className="text-purple-400">ARCHIVED MISSION:</span>
                        {activeHistoryItem.mission}
                     </h2>
                   </div>
                   {activeHistoryItem.plan?.map(step => (
                      <div key={step.step} className="p-4 rounded-xl border bg-white/5 border-white/10 opacity-70">
                         <span className="font-semibold text-white/80">{step.step}. {step.desc}</span>
                         <div className="mt-2 text-xs text-blue-400 font-mono tracking-wider">Tool: {step.tool}</div>
                      </div>
                   ))}
                </div>
             ) : (
                // View Real-Time Tracking
                <div className="flex-grow flex flex-col justify-end max-w-4xl w-full mx-auto">
                  <MissionTracker />
                </div>
             )}
          </div>
        </div>

        {/* Bottom Command Bar */}
        <footer className="p-8 mt-auto z-10 shrink-0">
          <div className="max-w-4xl mx-auto relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition duration-1000" />
            <div className="relative bg-white/5 border border-white/10 rounded-2xl flex items-center p-1 backdrop-blur-3xl shadow-2xl">
              <div className="pl-4 text-white/40">
                <Terminal size={20} />
              </div>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleExecute()}
                placeholder="Assign a new mission to Antigravity..."
                className="flex-grow bg-transparent border-none focus:ring-0 text-white px-4 py-4 placeholder:text-white/20 font-medium"
              />
              <button 
                onClick={handleExecute}
                disabled={isProcessing}
                className="bg-white hover:bg-white/90 disabled:bg-white/10 disabled:text-white/30 text-black p-3 rounded-xl transition-all mr-1"
              >
                {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
              </button>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
