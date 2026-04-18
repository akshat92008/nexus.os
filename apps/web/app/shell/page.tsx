'use client';

import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Terminal, Loader2, ShieldAlert } from 'lucide-react';
import { MissionLog, LogEntry } from '@/components/shell/MissionLog';
import { StatusHud } from '@/components/shell/StatusHud';

export default function CyberShell() {
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [pendingTool, setPendingTool] = useState<any>(null);
  
  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    const newLog: LogEntry = {
      id: Math.random().toString(36).substr(2, 9),
      message,
      type,
      timestamp: new Date().toISOString(),
    };
    setLogs(prev => [...prev, newLog]);
  };

  const handleExecute = async () => {
    if (!input.trim() || isProcessing) return;

    const mission = input.trim();
    setInput('');
    setIsProcessing(true);
    addLog(`Initiating mission: "${mission}"`, 'info');
    addLog('Querying Brain Intelligence...', 'think');

    try {
      // 1. Call Rust Backend -> AI Service
      const response: any = await invoke('execute_mission', {
        message: mission,
        sessionId: 'native-session-001',
        history: logs.map(l => ({ role: l.type === 'think' ? 'assistant' : 'user', content: l.message }))
      });

      addLog(`Brain Response: ${response.explanation}`, 'info');

      // 2. Handle Tool Call
      if (response.intent === 'power') {
        setPendingTool(response);
        addLog(`High-level tool detected: ${response.tool}. Waiting for CEO confirmation.`, 'warning');
      } else {
        await executeTool(response.tool, response.params);
      }
    } catch (err: any) {
      addLog(`Mission Failure: ${err}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const executeTool = async (tool: string, params: any) => {
    addLog(`Executing tool: ${tool}...`, 'info');
    try {
      const output: string = await invoke('run_tool', { tool, params });
      addLog(output, 'success');
    } catch (err: any) {
      addLog(`Tool execution failed: ${err}`, 'error');
    }
  };

  const handleConfirm = async () => {
    if (!pendingTool) return;
    const tool = pendingTool.tool;
    const params = pendingTool.params;
    setPendingTool(null);
    await executeTool(tool, params);
  };

  return (
    <div className="flex h-screen bg-[#050505] text-white font-sans selection:bg-blue-500/30">
      {/* Sidebar HUD */}
      <StatusHud 
        brainStatus="online" 
        nerveStatus={isProcessing ? 'reconnecting' : 'connected'} 
        currentAgent={isProcessing ? 'Thinking...' : 'READY'}
      />

      {/* Main Command Center */}
      <main className="flex-grow flex flex-col relative overflow-hidden">
        {/* Glass Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full" />
        </div>

        {/* Header */}
        <header className="h-16 border-b border-white/5 flex items-center px-8 z-10">
          <div className="flex items-center space-x-3">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <h1 className="text-sm font-bold tracking-[0.2em] text-white/80 uppercase">Nerve Engine // V3.0</h1>
          </div>
        </header>

        {/* Mission Log */}
        <MissionLog entries={logs} />

        {/* Confirmation Modal Overlay */}
        <AnimatePresence>
          {pendingTool && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-8"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                className="max-w-md w-full bg-[#0a0a0a] border border-yellow-500/30 p-8 rounded-2xl shadow-2xl shadow-yellow-500/5"
              >
                <div className="flex items-center space-x-4 mb-6 text-yellow-500">
                  <ShieldAlert size={32} />
                  <h2 className="text-xl font-bold tracking-tight">CEO Authorization Required</h2>
                </div>
                <p className="text-white/60 text-sm leading-relaxed mb-8">
                  The Brain has requested a <span className="text-white font-bold inline-flex items-center">POWERLANE</span> operation:
                  <code className="block mt-4 p-4 bg-white/5 rounded-lg border border-white/10 text-blue-400">
                    {pendingTool.tool}({JSON.stringify(pendingTool.params)})
                  </code>
                </p>
                <div className="flex space-x-4">
                  <button 
                    onClick={handleConfirm}
                    className="flex-grow bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-xl transition-all active:scale-95"
                  >
                    AUTHORIZE
                  </button>
                  <button 
                    onClick={() => setPendingTool(null)}
                    className="px-8 bg-white/5 hover:bg-white/10 text-white/70 font-bold py-3 rounded-xl transition-all"
                  >
                    DENY
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom Command Bar */}
        <footer className="p-8 mt-auto z-10">
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
                placeholder="Initiate Mission..."
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
