'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trophy, Code, GraduationCap, ChevronRight, Check, 
  Search, Brain, ShieldCheck, Sparkles 
} from 'lucide-react';
import { useNexusStore } from '../../store/nexusStore';
import { useModeStore, NexusMode } from '../../store/modeStore';
import { useNexusSSE } from '../../hooks/useNexusSSE';

const Personas = [
  {
    id: 'founder' as NexusMode,
    title: 'Founder',
    icon: Trophy,
    description: 'Build startups, analyze markets, and craft winning strategies.',
    color: 'emerald',
  },
  {
    id: 'developer' as NexusMode,
    title: 'Developer',
    icon: Code,
    description: 'Architect software, automate workflows, and optimize performance.',
    color: 'violet',
  },
  {
    id: 'student' as NexusMode,
    title: 'Student',
    icon: GraduationCap,
    description: 'Master new domains, synthesize research, and prepare for exams.',
    color: 'sky',
  },
];

export function OnboardingWizard() {
  const [step, setStep] = useState(1);
  const [selectedPersona, setSelectedPersona] = useState<NexusMode | null>(null);
  const [missionGoal, setMissionGoal] = useState('');
  const [isFinishing, setIsFinishing] = useState(false);

  const setOnboardingComplete = useNexusStore((s) => s.setOnboardingComplete);
  const setMode = useModeStore((s) => s.setMode);
  const { startOrchestration } = useNexusSSE();
  const userId = useNexusStore((s) => s.session.userId);

  const handleFinish = async () => {
    if (!selectedPersona || !missionGoal || !userId) return;
    setIsFinishing(true);
    
    // Smooth transition
    await new Promise(r => setTimeout(r, 2000));
    
    setMode(selectedPersona);
    setOnboardingComplete();
    void startOrchestration(missionGoal, selectedPersona);
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-md p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-2xl bg-zinc-950 border border-white/10 rounded-[40px] shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Progress Bar */}
        <div className="h-1.5 w-full bg-white/5 flex">
          {[1, 2, 3].map((s) => (
            <div 
              key={s} 
              className={`h-full flex-1 transition-all duration-500 ${s <= step ? 'bg-violet-500' : 'bg-transparent'}`} 
            />
          ))}
        </div>

        <div className="p-10 flex-1">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div>
                  <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Choose Your Persona</h2>
                  <p className="text-zinc-400 font-medium">Nexus OS tailors its intelligence to your specific workflow.</p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {Personas.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPersona(p.id)}
                      className={`flex items-center gap-6 p-6 rounded-3xl border transition-all text-left group ${
                        selectedPersona === p.id 
                          ? `bg-${p.color}-500/10 border-${p.color}-500/50 shadow-lg shadow-${p.color}-500/5` 
                          : 'bg-white/5 border-white/5 hover:border-white/20 hover:bg-white/[0.07]'
                      }`}
                    >
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${
                        selectedPersona === p.id ? `bg-${p.color}-500/20 text-${p.color}-400` : 'bg-zinc-800 text-zinc-400 group-hover:text-zinc-200'
                      }`}>
                        <p.icon size={28} />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-white mb-1">{p.title}</h3>
                        <p className="text-sm text-zinc-500 leading-snug">{p.description}</p>
                      </div>
                      {selectedPersona === p.id && (
                        <div className={`w-6 h-6 rounded-full bg-${p.color}-500 flex items-center justify-center text-white shrink-0`}>
                          <Check size={14} strokeWidth={4} />
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                <div className="pt-4">
                  <button
                    disabled={!selectedPersona}
                    onClick={() => setStep(2)}
                    className="w-full h-14 bg-white text-black rounded-2xl font-black text-sm uppercase tracking-widest disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2"
                  >
                    Continue <ChevronRight size={18} />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div>
                  <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Your First Mission</h2>
                  <p className="text-zinc-400 font-medium">What is the most important goal we should tackle first?</p>
                </div>

                <div className="relative group">
                   <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-violet-500 to-cyan-500 scale-x-0 group-focus-within:scale-x-100 transition-transform duration-500" />
                   <textarea
                    autoFocus
                    placeholder="e.g. Research the feasibility of a subscription-based solar energy farm in Berlin..."
                    value={missionGoal}
                    onChange={(e) => setMissionGoal(e.target.value)}
                    className="w-full h-32 bg-white/5 border-none p-6 rounded-3xl text-xl text-white placeholder:text-zinc-700 focus:ring-0 resize-none font-medium leading-relaxed"
                   />
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => setStep(1)}
                    className="flex-1 h-14 bg-white/5 text-zinc-400 rounded-2xl font-bold hover:text-white transition-colors"
                  >
                    Back
                  </button>
                  <button
                    disabled={missionGoal.length < 10}
                    onClick={() => setStep(3)}
                    className="flex-[2] h-14 bg-white text-black rounded-2xl font-black text-sm uppercase tracking-widest disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2"
                  >
                    Analyze Approach <ChevronRight size={18} />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div 
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-12 py-4"
              >
                <div className="text-center">
                  <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Preparing Orchestration</h2>
                  <p className="text-zinc-400 font-medium italic">Nexus is assembling the Council of Three for this mission.</p>
                </div>

                <div className="space-y-4 max-w-sm mx-auto">
                   <AgentRow icon={Brain} label="Nexus Master Brain" delay={0.2} desc="Strategy & Decomposition" color="violet" />
                   <AgentRow icon={Search} label="Research Hive" delay={0.6} desc="Live Web Extraction" color="cyan" />
                   <AgentRow icon={ShieldCheck} label="Semantic Auditor" delay={1.0} desc="Fact Checking & Bias Shield" color="emerald" />
                </div>

                <div className="pt-8">
                  <button
                    disabled={isFinishing}
                    onClick={handleFinish}
                    className="w-full h-16 bg-gradient-to-r from-violet-600 to-cyan-600 text-white rounded-[20px] font-black text-sm uppercase tracking-[0.2em] shadow-lg shadow-violet-500/20 flex items-center justify-center gap-3 active:scale-95 transition-all overflow-hidden relative"
                  >
                    {isFinishing ? (
                      <div className="flex items-center gap-2">
                         <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                         <span>Initializing Workspace...</span>
                      </div>
                    ) : (
                      <>
                        <Sparkles size={18} className="animate-pulse" />
                        Enter nexus
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

function AgentRow({ icon: Icon, label, desc, delay, color }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5"
    >
      <div className={`w-10 h-10 rounded-xl bg-${color}-500/20 text-${color}-400 flex items-center justify-center shrink-0`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-bold text-white leading-none mb-1">{label}</div>
        <div className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">{desc}</div>
      </div>
      <div className="ml-auto">
         <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: delay + 0.3 }} className={`w-5 h-5 rounded-full bg-${color}-500/10 flex items-center justify-center text-${color}-500`}>
            <Check size={12} strokeWidth={3} />
         </motion.div>
      </div>
    </motion.div>
  );
}
