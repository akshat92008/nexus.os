'use client';

import React from 'react';
import { 
  Plus, 
  Bot, 
  Search, 
  Library, 
  ShoppingBag, 
  LayoutDashboard, 
  Terminal,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useNexusStore } from '../../store/nexusStore';
import { createClient } from '../../lib/supabase';

export function Sidebar() {
  const { toggleAgentsView, toggleAppLauncher, toggleDashboard, toggleLibraryView, toggleSearchView } = useNexusStore();
  const [collapsed, setCollapsed] = React.useState(false);

  const navItems = [
    { id: 'new-task', label: 'New task', icon: Plus, action: () => {}, primary: true },
    { id: 'agent', label: 'Agent', icon: Bot, action: toggleAgentsView, tag: 'New' },
    { id: 'search', label: 'Search', icon: Search, action: toggleSearchView },
    { id: 'library', label: 'Library', icon: Library, action: toggleLibraryView },
  ];

  const footerItems = [
    { id: 'market', label: 'Marketplace', icon: ShoppingBag, action: toggleAgentsView },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, action: toggleDashboard },
    { id: 'terminal', label: 'Terminal', icon: Terminal, action: toggleAppLauncher },
    { id: 'signout', label: 'Sign out', icon: LogOut, action: async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.reload();
    }},
  ];

  return (
    <motion.div 
      initial={false}
      animate={{ width: collapsed ? 80 : 260 }}
      className="h-screen bg-[#0F1115] border-r border-white/5 flex flex-col relative z-[500] transition-all duration-300"
    >
      {/* Header / New Task */}
      <div className="p-6 pb-2">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-600/20">
            <span className="font-black text-white text-xs">N</span>
          </div>
          {!collapsed && <span className="font-bold text-sm tracking-tight">nexus</span>}
        </div>

        <button 
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-900 border border-white/5 hover:bg-zinc-800 transition-all group ${collapsed ? 'justify-center' : ''}`}
        >
          <Plus size={18} className="text-zinc-400 group-hover:text-white transition-colors" />
          {!collapsed && <span className="text-sm font-semibold text-zinc-300 group-hover:text-white">New task</span>}
        </button>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 px-4 py-6 space-y-1">
        {navItems.filter(i => !i.primary).map((item) => (
          <button
            key={item.id}
            onClick={item.action}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/[0.03] transition-all group ${collapsed ? 'justify-center' : ''}`}
          >
            <item.icon size={18} className="text-zinc-500 group-hover:text-zinc-300 transition-colors" />
            {!collapsed && (
              <div className="flex-1 flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-400 group-hover:text-zinc-200">{item.label}</span>
                {item.tag && (
                  <span className="text-[10px] font-bold bg-violet-500/10 text-violet-400 px-1.5 py-0.5 rounded border border-violet-500/20 uppercase tracking-widest">
                    {item.tag}
                  </span>
                )}
              </div>
            )}
          </button>
        ))}
      </nav>

      {/* Footer Nav */}
      <div className="px-4 py-6 border-t border-white/5 space-y-1">
        {footerItems.map((item) => (
          <button
            key={item.id}
            onClick={item.action}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/[0.03] transition-all group ${collapsed ? 'justify-center' : ''}`}
          >
            <item.icon size={18} className="text-zinc-500 group-hover:text-zinc-300 transition-colors" />
            {!collapsed && <span className="text-sm font-medium text-zinc-400 group-hover:text-zinc-200">{item.label}</span>}
          </button>
        ))}
      </div>

      {/* Collapse Toggle */}
      <button 
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center hover:bg-zinc-800 transition-colors"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </motion.div>
  );
}
