'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { CreditCard, AlertCircle, ArrowLeft, ShieldAlert, Sparkles } from 'lucide-react';
import Link from 'next/link';

export default function BillingPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 selection:bg-violet-500/30">
      {/* Background Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[600px] h-[300px] bg-violet-600/10 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[600px] h-[300px] bg-indigo-600/10 blur-[120px] rounded-full" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-xl w-full"
      >
        <div className="relative group">
          {/* Card Border Glow */}
          <div className="absolute -inset-[1px] bg-gradient-to-r from-violet-600 to-indigo-600 rounded-3xl blur-sm opacity-25 group-hover:opacity-40 transition-opacity" />
          
          <div className="relative bg-[#0d0d0d] border border-white/5 rounded-3xl p-8 md:p-12 text-center overflow-hidden">
            {/* Pattern */}
            <div className="absolute top-0 right-0 p-4 opacity-[0.03]">
              <Sparkles size={80} />
            </div>

            <div className="flex justify-center mb-8">
              <div className="relative">
                <div className="absolute inset-0 bg-violet-600/20 blur-2xl rounded-full" />
                <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] border border-white/10 flex items-center justify-center">
                  <ShieldAlert className="text-violet-500" size={40} />
                </div>
              </div>
            </div>

            <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60 mb-4">
              Billing Restricted
            </h1>
            
            <p className="text-gray-400 text-lg leading-relaxed mb-10">
              Nexus OS financial controls are currently <span className="text-white font-medium">disabled</span> in this environment. 
              Top-ups and enterprise subscription management are temporarily offline for system hardening.
            </p>

            <div className="bg-violet-600/5 border border-violet-500/10 rounded-2xl p-6 mb-10 text-left">
              <div className="flex items-start gap-4">
                <AlertCircle className="text-violet-500 shrink-0 mt-1" size={20} />
                <div>
                  <h3 className="text-sm font-semibold text-white mb-1">Notice for Sandbox Users</h3>
                  <p className="text-sm text-gray-400">
                    If your agentic credits reach zero during testing, please reach out to the system administrator or use a development bypass token.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                href="/"
                className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-white text-black font-semibold hover:bg-gray-200 transition-colors"
              >
                <ArrowLeft size={18} />
                Back to Command
              </Link>
              <button 
                onClick={() => window.location.reload()}
                className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-semibold hover:bg-white/10 transition-colors"
              >
                Retry Connection
              </button>
            </div>
          </div>
        </div>

        <div className="mt-12 text-center">
          <p className="text-xs text-gray-600 uppercase tracking-widest font-medium">
            Nexus Operating System • v2.5.0 • Galactic Command
          </p>
        </div>
      </motion.div>
    </div>
  );
}
