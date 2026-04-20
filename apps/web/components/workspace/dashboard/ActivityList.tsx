'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Tag } from 'lucide-react';

import { useNexusStore } from '../../store/nexusStore';

export function ActivityList() {
  const ongoingMissions = useNexusStore(s => Object.values(s.ongoingMissions || {}).slice().reverse());
  const setActiveWorkspace = useNexusStore(s => s.setActiveWorkspace);
  const toggleDashboard = useNexusStore(s => s.toggleDashboard);

  const activities = ongoingMissions.map((m: any) => ({
    id: m.id,
    title: m.goal.substring(0, 40) + (m.goal.length > 40 ? '...' : ''),
    description: m.goal,
    date: new Date(m.startedAt || Date.now()).toLocaleDateString(),
    tag: m.status === 'running' ? 'Active' : m.status,
    tagColor: m.status === 'running' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-500/10 text-zinc-500'
  }));

  const handleLaunchActivity = (id: string) => {
    setActiveWorkspace(id);
    toggleDashboard(); 
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-medium text-white">Recent Activity</h2>
      </div>
      
      {activities.length === 0 ? (
        <div className="text-zinc-500 text-sm mt-4">No recent activity. Head to the home page to launch a mission!</div>
      ) : (
        activities.slice(0, 3).map((activity, i) => (
          <motion.div
           key={i}
           initial={{ opacity: 0, x: 20 }}
           animate={{ opacity: 1, x: 0 }}
           transition={{ delay: 0.3 + (0.1 * i) }}
           onClick={() => handleLaunchActivity(activity.id)}
           className="bg-[#161616] border border-white/5 rounded-3xl p-6 hover:bg-[#1c1c1c] transition-colors cursor-pointer group"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="text-zinc-500 text-xs font-medium uppercase tracking-wider">
              {activity.date}
            </div>
            <div className="text-zinc-600 group-hover:text-zinc-400 transition-colors">
              <MessageSquare size={16} />
            </div>
          </div>
          
          <h3 className="text-xl font-medium text-white mb-2 group-hover:text-violet-400 transition-colors">
            {activity.title}
          </h3>
          <p className="text-zinc-400 text-sm mb-6 line-clamp-2 leading-relaxed">
            {activity.description}
          </p>
          
          <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${activity.tagColor}`}>
            {activity.tag}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
