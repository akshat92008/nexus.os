import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNexusStore, ApplicationWindowType } from '../../store/nexusStore';
import { 
  Network, 
  Database, 
  BrainCircuit, 
  Code, 
  PenTool, 
  LayoutTemplate, 
  X, 
  Sparkles, 
  ArrowUpRight,
  TrendingUp,
  Clock,
  FileText,
  Calendar
} from 'lucide-react';

// ── Types & Data ─────────────────────────────────────────────────────────────

interface AppConfig {
  type: ApplicationWindowType;
  title: string;
  icon: React.ElementType;
  description: string;
  gradient: string;
}

const APPS: AppConfig[] = [
  {
    type: 'financial_dashboard',
    title: 'Financial Dashboard',
    icon: TrendingUp,
    description: 'Real-time financial overview of business performance.',
    gradient: 'from-emerald-500/20 to-teal-500/20 text-emerald-400',
  },
  {
    type: 'time_tracker',
    title: 'Time Tracker',
    icon: Clock,
    description: 'Track time, measure productivity, and generate reports.',
    gradient: 'from-blue-500/20 to-indigo-500/20 text-blue-400',
  },
  {
    type: 'invoicing',
    title: 'Invoicing',
    icon: FileText,
    description: 'Generate professional invoices and track payments.',
    gradient: 'from-amber-500/20 to-orange-500/20 text-amber-400',
  },
  {
    type: 'calendar',
    title: 'Calendar',
    icon: Calendar,
    description: 'Unified calendar and meeting management.',
    gradient: 'from-violet-500/20 to-purple-500/20 text-violet-400',
  },
  {
    type: 'lead_engine',
    title: 'Lead Engine',
    icon: Network,
    description: 'Find, enrich, and qualify B2B targets autonomously.',
    gradient: 'from-blue-500/20 to-cyan-500/20 text-cyan-400',
  },
  {
    type: 'research_lab',
    title: 'Research Lab',
    icon: Database,
    description: 'Deep-dive entity analysis and market intelligence gathering.',
    gradient: 'from-violet-500/20 to-purple-500/20 text-purple-400',
  },
  {
    type: 'strategy_board',
    title: 'Strategy Board',
    icon: BrainCircuit,
    description: 'Competitive teardowns, positioning, and strategic modeling.',
    gradient: 'from-emerald-500/20 to-teal-500/20 text-teal-400',
  },
  {
    type: 'code_studio',
    title: 'Code Studio',
    icon: Code,
    description: 'Architecture design, code review, and automated refactoring.',
    gradient: 'from-orange-500/20 to-red-500/20 text-orange-400',
  },
  {
    type: 'content_engine',
    title: 'Content Engine',
    icon: PenTool,
    description: 'Drafting, SEO optimization, and multi-channel formatting.',
    gradient: 'from-pink-500/20 to-rose-500/20 text-pink-400',
  },
  {
    type: 'general',
    title: 'General Mission',
    icon: LayoutTemplate,
    description: 'Custom multi-agent orchestration for unconstrained goals.',
    gradient: 'from-gray-500/20 to-slate-500/20 text-slate-300',
  },
];

// ── Component ────────────────────────────────────────────────────────────────

export function AppLauncher() {
  const { 
    ui, 
    setAppLauncherOpen, 
    createWorkspaceShell,
    toggleAgentsView,
    toggleFinancialView,
    toggleTimeTrackingView,
    toggleInvoicingView,
    toggleCalendarView
  } = useNexusStore();

  if (!ui.appLauncherOpen) return null;

  const handleLaunch = async (app: AppConfig) => {
    // Handle special dashboard/view apps
    if (app.type === 'financial_dashboard') {
      toggleFinancialView();
      return;
    }
    if (app.type === 'time_tracker') {
      toggleTimeTrackingView();
      return;
    }
    if (app.type === 'invoicing') {
      toggleInvoicingView();
      return;
    }
    if (app.type === 'calendar') {
      toggleCalendarView();
      return;
    }

    await createWorkspaceShell(app.type, app.title);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] grid place-items-center bg-[#070514]/80 backdrop-blur-md p-4"
        onClick={() => setAppLauncherOpen(false)}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative w-full max-w-4xl bg-[#0f0c29] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-500/20 text-violet-400 border border-violet-500/30">
                <Sparkles size={20} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">App Launcher</h2>
                <p className="text-sm text-slate-400">Deploy specialized agentic environments</p>
              </div>
            </div>
            <button
              onClick={() => setAppLauncherOpen(false)}
              className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6 bg-[#0B0914]">
            {APPS.map((app) => (
              <button
                key={app.type}
                onClick={() => void handleLaunch(app)}
                className="group relative flex flex-col items-start p-5 rounded-xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.04] hover:border-white/10 transition-all text-left"
              >
                <div
                  className={`flex items-center justify-center w-12 h-12 rounded-xl mb-4 bg-gradient-to-br transition-all group-hover:scale-110 group-hover:shadow-lg ${app.gradient}`}
                >
                  <app.icon size={24} />
                </div>
                <h3 className="text-base font-semibold text-white mb-1 group-hover:text-violet-300 transition-colors">
                  {app.title}
                </h3>
                <p className="text-sm text-slate-400 line-clamp-2">
                  {app.description}
                </p>
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-white/5 bg-[#0f0c29] flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
                <Sparkles size={14} className="text-violet-400" />
                300 Credits
              </div>
              <button 
                onClick={() => {
                  setAppLauncherOpen(false);
                  toggleAgentsView();
                }}
                className="text-xs font-bold text-violet-400 hover:text-violet-300 uppercase tracking-widest transition-colors flex items-center gap-1.5"
              >
                Agent Marketplace <ArrowUpRight size={14} />
              </button>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-slate-600 font-bold uppercase tracking-widest">
              <span>Agentic OS v2.0</span>
              <div className="w-1 h-1 rounded-full bg-slate-800" />
              <span>Founder Edition</span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
