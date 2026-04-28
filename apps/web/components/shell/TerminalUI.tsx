'use client';

import { useState, useRef, useEffect } from 'react';
import { Terminal, Send, Command, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase';

const API_BASE = process.env.NEXT_PUBLIC_NEXUS_API_URL || 'http://localhost:3006/api';

interface LogEntry {
  type: 'user' | 'system' | 'error';
  content: string;
  results?: any[];
}

export function TerminalUI() {
  const [input, setInput] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([
    { type: 'system', content: 'Nex initialized. Awaiting tasks...' }
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isProcessing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    const command = input;
    setInput('');
    setLogs(prev => [...prev, { type: 'user', content: command }]);
    setIsProcessing(true);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`${API_BASE}/nexus/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({ command }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }
      
      const data = await response.json();

      setLogs(prev => [...prev, { 
        type: 'system', 
        content: data.response,
        results: data.results 
      }]);
    } catch (err: any) {
      setLogs(prev => [...prev, { type: 'error', content: `Execution failed: ${err.message}` }]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] bg-[#0A0A0A] border border-[#333] rounded-lg overflow-hidden shadow-2xl font-mono">
      {/* Header */}
      <div className="flex items-center px-4 py-2 bg-[#1A1A1A] border-b border-[#333]">
        <Terminal className="w-4 h-4 text-[#888] mr-2" />
        <span className="text-xs text-[#888] font-semibold tracking-wider">NEXUS.OS // NEX</span>
        <div className="ml-auto flex space-x-2">
          <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
          <div className="w-3 h-3 rounded-full bg-green-500/50 border border-green-500"></div>
        </div>
      </div>

      {/* Output Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 text-sm"
      >
        {logs.map((log, i) => (
          <div key={i} className={`flex flex-col ${log.type === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[80%] rounded px-3 py-2 ${
              log.type === 'user' 
                ? 'bg-blue-900/30 text-blue-300 border border-blue-800/50' 
                : log.type === 'error'
                  ? 'bg-red-900/30 text-red-400 border border-red-800/50'
                  : 'bg-[#1A1A1A] text-emerald-400 border border-[#333]'
            }`}>
              <div className="whitespace-pre-wrap">{log.content}</div>
              
              {/* Nested results if present */}
              {log.results && log.results.length > 0 && (
                <div className="mt-3 space-y-2 border-t border-[#333] pt-3">
                  <div className="text-xs text-gray-500 uppercase">Execution Trace</div>
                  {log.results.map((res, j) => (
                    <div key={j} className="text-xs bg-black/50 p-2 rounded border border-[#222]">
                      <span className={res.status === 'success' ? 'text-green-500' : 'text-red-500'}>
                        [{res.status.toUpperCase()}]
                      </span> {JSON.stringify(res.result || res.error)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {isProcessing && (
          <div className="flex items-center text-gray-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Nex is working...
          </div>
        )}
      </div>

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="p-4 bg-[#1A1A1A] border-t border-[#333]">
        <div className="relative flex items-center">
          <Command className="absolute left-3 w-4 h-4 text-emerald-500" />
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={isProcessing}
            placeholder="Assign a task to Nex..."
            className="w-full bg-black border border-[#333] rounded-md py-3 pl-10 pr-12 text-sm text-emerald-400 placeholder-gray-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 transition-all"
            autoFocus
          />
          <button 
            type="submit" 
            disabled={!input.trim() || isProcessing}
            className="absolute right-2 p-1.5 rounded text-gray-400 hover:text-emerald-400 disabled:opacity-50 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
