'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Mail, ArrowRight, Zap, Star } from 'lucide-react';

export default function WaitlistPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setStatus('loading');
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3006'}/api/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Submission failed');

      setStatus('success');
      setMessage(data.message);
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-8 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-blue-600/5 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="max-w-2xl w-full z-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-widest mb-8"
        >
          <Star size={12} className="fill-blue-400" />
          <span>Private Beta v3.2</span>
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-5xl md:text-6xl font-bold tracking-tight mb-6 bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent"
        >
          The Sovereign OS Layer.
        </motion.h1>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-lg text-white/40 mb-12 leading-relaxed"
        >
          Nexus OS is currently in high-security private beta. 
          Request access to be among the first to experience native agentic GUI control and autonomous macOS missions.
        </motion.p>

        <AnimatePresence mode="wait">
          {status === 'success' ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-green-500/10 border border-green-500/20 p-8 rounded-3xl"
            >
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-green-400">
                <ShieldCheck size={32} />
              </div>
              <h3 className="text-xl font-bold mb-2">You're on the list!</h3>
              <p className="text-sm text-green-400/60 leading-relaxed">
                We've secured your spot. Keep an eye on your inbox for your private access token.
              </p>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: 0.3 }}
              onSubmit={handleSubmit}
              className="relative group max-w-md mx-auto"
            >
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition duration-1000" />
              <div className="relative flex items-center bg-white/5 border border-white/10 p-1.5 rounded-2xl backdrop-blur-3xl">
                <div className="pl-4 text-white/30">
                  <Mail size={20} />
                </div>
                <input 
                  type="email"
                  required
                  value={email}
                  disabled={status === 'loading'}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email..."
                  className="flex-grow bg-transparent border-none focus:ring-0 text-white px-4 py-3 placeholder:text-white/20 text-sm font-medium"
                />
                <button 
                  type="submit"
                  disabled={status === 'loading'}
                  className="bg-white hover:bg-white/90 disabled:bg-white/10 text-black px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center space-x-2"
                >
                  <span>{status === 'loading' ? 'Securing...' : 'Request Access'}</span>
                  {status !== 'loading' && <ArrowRight size={16} />}
                </button>
              </div>
              {status === 'error' && (
                <p className="mt-4 text-xs text-red-400 font-medium">{message}</p>
              )}
            </motion.form>
          )}
        </AnimatePresence>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-24 grid grid-cols-3 gap-8 border-t border-white/5 pt-12 opacity-50"
        >
          <FeatureItem icon={<Zap size={16} />} title="Native Core" />
          <FeatureItem icon={<ShieldCheck size={16} />} title="Hardened Security" />
          <FeatureItem icon={<Mail size={16} />} title="Private Access" />
        </motion.div>
      </div>
    </div>
  );
}

function FeatureItem({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex flex-col items-center space-y-2">
      <div className="text-white/40">{icon}</div>
      <span className="text-[10px] uppercase font-bold tracking-widest text-white/60">{title}</span>
    </div>
  );
}
