'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Bookmark, User, FileText, Share2 } from 'lucide-react';

import { useNexusStore } from '../../../store/nexusStore';

export function StatsGrid() {
  const fsItems = useNexusStore((s) => s.fsItems || []);
  const installedAgentIds = useNexusStore((s) => s.installedAgentIds || []);
  const ongoingMissions = useNexusStore((s) => Object.values(s.ongoingMissions || {}));
  
  const stats = [
    {
      label: 'Favorite Prompts',
      value: '15',
      icon: Bookmark,
      bg: 'bg-white',
      text: 'text-zinc-900',
      iconBg: 'bg-zinc-100',
      iconColor: 'text-zinc-900'
    },
    {
      label: 'AI Agents',
      value: `${installedAgentIds.length}`,
      icon: User,
      bg: 'bg-[#E2F1E8]',
      text: 'text-zinc-900',
      iconBg: 'bg-[#D1E8DB]',
      iconColor: 'text-zinc-900'
    },
    {
      label: 'Uploaded Docs',
      value: `${fsItems.length}`,
      icon: FileText,
      bg: 'bg-[#FFF8E1]',
      text: 'text-zinc-900',
      iconBg: 'bg-[#FEF0C7]',
      iconColor: 'text-zinc-900'
    },
    {
      label: 'Flows Executed',
      value: `${ongoingMissions.length}`,
      icon: Share2,
      bg: 'bg-[#F3E8FF]',
      text: 'text-zinc-900',
      iconBg: 'bg-[#E9D7FE]',
      iconColor: 'text-zinc-900'
    }
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
      {stats.map((stat, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 * i, duration: 0.5 }}
          className={`${stat.bg} ${stat.text} rounded-[32px] p-8 flex flex-col justify-between min-h-[200px] shadow-sm hover:scale-[1.02] transition-transform cursor-default`}
        >
          <div className={`${stat.iconBg} w-12 h-12 rounded-2xl flex items-center justify-center`}>
            <stat.icon size={20} className={stat.iconColor} />
          </div>
          
          <div>
            <div className="text-5xl font-medium tracking-tighter mb-1">
              {stat.value}
            </div>
            <div className="text-zinc-500 font-medium text-sm">
              {stat.label}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
