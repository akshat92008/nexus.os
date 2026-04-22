'use client';

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface LogEntry {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'think';
  message: string;
  timestamp: string;
}

interface MissionLogProps {
  entries: LogEntry[];
}

export const MissionLog: React.FC<MissionLogProps> = ({ entries }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  return (
    <div 
      ref={scrollRef}
      className="flex-grow overflow-y-auto p-4 space-y-2 font-mono text-sm scrollbar-hide"
      style={{ maxHeight: '60vh' }}
    >
      <AnimatePresence initial={false}>
        {entries.map((entry) => (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className={`flex space-x-2 ${
              entry.type === 'error' ? 'text-red-400' :
              entry.type === 'success' ? 'text-green-400' :
              entry.type === 'warning' ? 'text-yellow-400' :
              entry.type === 'think' ? 'text-purple-400 italic' :
              'text-blue-300'
            }`}
          >
            <span className="opacity-50">[{entry.timestamp.split('T')[1].split('.')[0]}]</span>
            <span className="font-bold">
              {entry.type === 'think' ? '🧠 thinking' :
               entry.type === 'success' ? '✅ success' :
               entry.type === 'error' ? '❌ error' :
               '🔹 info'}:
            </span>
            <span>{entry.message}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
