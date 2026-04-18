'use client';

import React, { useEffect, useState } from 'react';
import { useNexusStore } from '../../store/nexusStore';
import { 
  LayoutGrid, User, Zap, FileText, Briefcase, 
  Settings, HelpCircle, Moon, LogOut, Search,
  Plus, Hexagon, Database, BarChart3, Image as ImageIcon
} from 'lucide-react';
import { motion } from 'framer-motion';
import { createClient } from '../../lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';

export function WorkspaceHistorySidebar() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const activeId = useNexusStore(s => s.activeWorkspaceId);
  const setActiveWorkspace = useNexusStore(s => s.setActiveWorkspace);
  const toggleAgentsView = useNexusStore(s => s.toggleAgentsView);
  const toggleDashboard = useNexusStore(s => s.toggleDashboard);
  const ui = useNexusStore(s => s.ui);
  
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUser(data.user);
    });
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.reload();
  };

  const getInitials = () => {
    if (!user?.email) return 'FE';
    return user.email.substring(0, 2).toUpperCase();
  };

  return (
    <div className="w-72 bg-[#161616] border-r border-white/5 flex flex-col h-full z-20 relative font-sans">
      
      {/* Brand Header */}
      <div className="p-8 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
            <Hexagon size={24} className="text-black" fill="currentColor" />
          </div>
          <span className="text-xl font-bold text-white tracking-tight">NeuroNest</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pt-4 space-y-8">
        
        {/* General Section */}
        <section className="space-y-1">
          <SectionHeader label="GENERAL" />
          <SidebarTab 
            icon={LayoutGrid} 
            label="Dashboards" 
            active={ui.dashboardOpen} 
            onClick={() => { setActiveWorkspace(null); toggleDashboard(); }} 
          />
          <SidebarTab icon={User} label="AI Agents" onClick={toggleAgentsView} />
          <SidebarTab icon={Zap} label="Workflows" />
          <SidebarTab icon={FileText} label="Documents" />
        </section>

        {/* Tools Section */}
        <section className="space-y-1">
          <SectionHeader label="TOOLS/RESOURCES" />
          <SidebarTab icon={ImageIcon} label="Assets" />
          <SidebarTab icon={Settings} label="Generator" />
          <SidebarTab icon={BarChart3} label="Analytics" />
        </section>

        {/* Settings Section */}
        <section className="space-y-1">
          <SectionHeader label="SETTINGS" />
          <SidebarTab icon={HelpCircle} label="Help Center" />
          <div className="flex items-center justify-between px-4 py-3 text-zinc-400">
            <div className="flex items-center gap-3 text-sm font-medium">
                <Moon size={18} />
                <span>Dark Mode</span>
            </div>
            <div className="w-10 h-5 bg-emerald-500 rounded-full relative flex items-center px-1">
                <div className="w-3 h-3 bg-white rounded-full absolute right-1" />
            </div>
          </div>
          <SidebarTab icon={Settings} label="Settings" />
        </section>

      </div>

      {/* User Profile Footer */}
      <div className="p-6 border-t border-white/5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 overflow-hidden border border-white/10">
             <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-white uppercase">
               {getInitials()}
             </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-white truncate">
               {user?.email?.split('@')[0] || 'Neuro User'}
            </div>
            <div className="text-[10px] text-zinc-500 truncate">{user?.email || 'Loading...'}</div>
          </div>
        </div>

        <button 
           onClick={handleSignOut}
           className="flex items-center gap-3 text-rose-500 hover:text-rose-400 transition-colors px-2 py-1 text-sm font-bold group"
        >
          <LogOut size={16} className="group-hover:-translate-x-1 transition-transform" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <h3 className="text-[10px] font-bold text-zinc-600 tracking-[0.15em] px-4 mb-2 uppercase">
      {label}
    </h3>
  );
}

function SidebarTab({ icon: Icon, label, active, onClick }: { icon: any; label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all group ${
        active 
          ? 'bg-white/5 border border-white/10 text-white shadow-xl' 
          : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.02]'
      }`}
    >
      <Icon size={18} className={active ? 'text-white' : 'text-zinc-600 group-hover:text-zinc-400'} />
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}
