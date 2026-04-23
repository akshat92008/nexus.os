'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderOpen, Zap, Check, ChevronRight, Rocket, GitBranch, FileCode, Terminal } from 'lucide-react';

interface ProjectConfig {
  name: string;
  type: 'nextjs' | 'tauri' | 'cli' | 'api';
  features: string[];
  gitInit: boolean;
  installDeps: boolean;
}

const templates = [
  { id: 'nextjs', label: 'Next.js App', icon: <Zap size={16} />, desc: 'Full-stack React with App Router' },
  { id: 'tauri', label: 'Tauri Desktop', icon: <Rocket size={16} />, desc: 'Rust + Web frontend desktop app' },
  { id: 'cli', label: 'Node CLI', icon: <Terminal size={16} />, desc: 'Command-line tool with TypeScript' },
  { id: 'api', label: 'API Server', icon: <FileCode size={16} />, desc: 'Express/Fastify REST API' },
];

const features = [
  'TypeScript',
  'ESLint + Prettier',
  'Docker',
  'GitHub Actions CI',
  'Supabase Auth',
  'Tailwind CSS',
  'Testing (Vitest)',
];

export function ProjectOnboarding() {
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState<ProjectConfig>({
    name: '',
    type: 'nextjs',
    features: ['TypeScript', 'ESLint + Prettier'],
    gitInit: true,
    installDeps: true,
  });
  const [creating, setCreating] = useState(false);
  const [done, setDone] = useState(false);

  const toggleFeature = (f: string) => {
    setConfig(c => ({
      ...c,
      features: c.features.includes(f) ? c.features.filter(x => x !== f) : [...c.features, f]
    }));
  };

  const createProject = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/project/scaffold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (res.ok) setDone(true);
    } catch (e) {}
    setCreating(false);
  };

  const steps = [
    // Step 0: Name
    <div key="name" className="space-y-4">
      <h2 className="text-lg font-black text-white">Name your project</h2>
      <input
        value={config.name}
        onChange={(e) => setConfig(c => ({ ...c, name: e.target.value }))}
        placeholder="my-awesome-project"
        className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-sm text-white placeholder:text-zinc-700 focus:outline-none focus:border-violet-500/50"
        autoFocus
      />
    </div>,

    // Step 1: Template
    <div key="template" className="space-y-4">
      <h2 className="text-lg font-black text-white">Choose a template</h2>
      <div className="grid grid-cols-2 gap-3">
        {templates.map(t => (
          <button
            key={t.id}
            onClick={() => setConfig(c => ({ ...c, type: t.id as any }))}
            className={`p-4 rounded-xl border text-left transition-all ${
              config.type === t.id
                ? 'bg-violet-500/10 border-violet-500/30'
                : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]'
            }`}
          >
            <div className={`mb-2 ${config.type === t.id ? 'text-violet-400' : 'text-zinc-500'}`}>{t.icon}</div>
            <div className="text-xs font-bold text-white">{t.label}</div>
            <div className="text-[10px] text-zinc-500 mt-1">{t.desc}</div>
          </button>
        ))}
      </div>
    </div>,

    // Step 2: Features
    <div key="features" className="space-y-4">
      <h2 className="text-lg font-black text-white">Select features</h2>
      <div className="space-y-2">
        {features.map(f => (
          <button
            key={f}
            onClick={() => toggleFeature(f)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
              config.features.includes(f)
                ? 'bg-emerald-500/5 border-emerald-500/20'
                : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]'
            }`}
          >
            <div className={`w-5 h-5 rounded-md border flex items-center justify-center ${
              config.features.includes(f) ? 'bg-emerald-500 border-emerald-500' : 'border-zinc-600'
            }`}>
              {config.features.includes(f) && <Check size={12} className="text-white" />}
            </div>
            <span className="text-xs text-zinc-300">{f}</span>
          </button>
        ))}
      </div>
      <div className="flex gap-3 pt-2">
        <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
          <input
            type="checkbox"
            checked={config.gitInit}
            onChange={(e) => setConfig(c => ({ ...c, gitInit: e.target.checked }))}
            className="rounded border-white/10 bg-white/5"
          />
          Initialize Git
        </label>
        <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
          <input
            type="checkbox"
            checked={config.installDeps}
            onChange={(e) => setConfig(c => ({ ...c, installDeps: e.target.checked }))}
            className="rounded border-white/10 bg-white/5"
          />
          Install dependencies
        </label>
      </div>
    </div>,

    // Step 3: Review
    <div key="review" className="space-y-4">
      <h2 className="text-lg font-black text-white">Ready to scaffold</h2>
      <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
        <div className="flex justify-between">
          <span className="text-[11px] text-zinc-500">Name</span>
          <span className="text-[11px] text-white font-mono">{config.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[11px] text-zinc-500">Template</span>
          <span className="text-[11px] text-white">{templates.find(t => t.id === config.type)?.label}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[11px] text-zinc-500">Features</span>
          <span className="text-[11px] text-white">{config.features.length} selected</span>
        </div>
        <div className="h-px bg-white/5" />
        <div className="flex gap-2 flex-wrap">
          {config.features.map(f => (
            <span key={f} className="text-[10px] px-2 py-1 rounded-md bg-white/5 border border-white/10 text-zinc-400">{f}</span>
          ))}
        </div>
      </div>
      <button
        onClick={createProject}
        disabled={creating}
        className="w-full h-12 bg-violet-500/10 border border-violet-500/20 rounded-xl text-xs font-black text-violet-400 uppercase tracking-widest hover:bg-violet-500/20 disabled:opacity-30 transition-colors flex items-center justify-center gap-2"
      >
        {creating ? <Zap size={14} className="animate-pulse" /> : <Rocket size={14} />}
        {creating ? 'Scaffolding...' : 'Create Project'}
      </button>
    </div>,
  ];

  if (done) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-zinc-950/40 rounded-3xl border border-white/5 backdrop-blur-3xl p-8">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
          <Check size={32} className="text-emerald-400" />
        </div>
        <h2 className="text-lg font-black text-white mb-2">Project Created!</h2>
        <p className="text-xs text-zinc-500 text-center mb-6">{config.name} is ready in your workspace.</p>
        <button
          onClick={() => { setStep(0); setDone(false); setConfig({ name: '', type: 'nextjs', features: ['TypeScript', 'ESLint + Prettier'], gitInit: true, installDeps: true }); }}
          className="px-4 h-10 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-zinc-300 hover:bg-white/10 transition-colors"
        >
          Create Another
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950/40 rounded-3xl border border-white/5 backdrop-blur-3xl overflow-hidden shadow-2xl p-6">
      {/* Progress */}
      <div className="flex items-center gap-2 mb-6">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-violet-500' : 'bg-white/10'}`} />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="flex-1"
        >
          {steps[step]}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/5">
        <button
          onClick={() => setStep(s => Math.max(0, s - 1))}
          disabled={step === 0}
          className="text-[11px] text-zinc-500 hover:text-zinc-300 disabled:opacity-30 transition-colors"
        >
          Back
        </button>
        <button
          onClick={() => setStep(s => Math.min(3, s + 1))}
          disabled={step === 3 || (step === 0 && !config.name)}
          className="flex items-center gap-2 h-9 px-4 bg-violet-500/10 border border-violet-500/20 rounded-lg text-[11px] font-bold text-violet-400 uppercase tracking-wider hover:bg-violet-500/20 disabled:opacity-30 transition-colors"
        >
          {step === 3 ? 'Review' : 'Next'}
          <ChevronRight size={12} />
        </button>
      </div>
    </div>
  );
}
