'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, DollarSign, Globe, Bell, Eye, EyeOff, Save, Check, RefreshCw, AlertTriangle } from 'lucide-react';

interface CostData {
  totalCalls: number;
  totalTokens: number;
  totalCost: number;
  byAgent: Record<string, { calls: number; tokens: number; cost: number }>;
  byDay: Record<string, { calls: number; tokens: number; cost: number }>;
}

export function SettingsView() {
  const [privacyMode, setPrivacyMode] = useState(false);
  const [locale, setLocale] = useState('en');
  const [notifications, setNotifications] = useState(true);
  const [costData, setCostData] = useState<CostData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/system/costs')
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setCostData(d))
      .catch(() => {});
  }, []);

  const saveSettings = async () => {
    setLoading(true);
    try {
      await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ privacy_mode: privacyMode, locale, notifications_enabled: notifications })
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {}
    setLoading(false);
  };

  const refreshCosts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/system/costs');
      if (res.ok) {
        const data = await res.json();
        setCostData(data);
      }
    } catch (e) {}
    setLoading(false);
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-white tracking-tight">Settings</h2>
        <button
          onClick={saveSettings}
          disabled={loading}
          className={`h-10 px-5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${
            saved
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
              : 'bg-violet-500/10 border border-violet-500/20 text-violet-400 hover:bg-violet-500/20'
          }`}
        >
          {saved ? <Check size={14} /> : <Save size={14} />}
          {saved ? 'Saved' : 'Save'}
        </button>
      </div>

      {/* Privacy Mode */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-5 rounded-2xl bg-white/[0.02] border border-white/5"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
              {privacyMode ? <EyeOff size={18} className="text-rose-400" /> : <Eye size={18} className="text-zinc-400" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Privacy Mode</h3>
              <p className="text-[11px] text-zinc-500">Strip PII from logs and disable external telemetry</p>
            </div>
          </div>
          <button
            onClick={() => setPrivacyMode(!privacyMode)}
            className={`w-12 h-6 rounded-full transition-colors relative ${privacyMode ? 'bg-rose-500' : 'bg-zinc-700'}`}
          >
            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${privacyMode ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
        </div>
        {privacyMode && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-950/20 border border-rose-500/10">
            <AlertTriangle size={14} className="text-rose-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-rose-400 leading-relaxed">
              When enabled, emails, phone numbers, and tokens are redacted from all logs. 
              Integration credentials are masked. No telemetry leaves your machine.
            </p>
          </div>
        )}
      </motion.div>

      {/* Locale */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="p-5 rounded-2xl bg-white/[0.02] border border-white/5"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Globe size={18} className="text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Language & Region</h3>
            <p className="text-[11px] text-zinc-500">Preferred locale for agent responses</p>
          </div>
        </div>
        <select
          value={locale}
          onChange={(e) => setLocale(e.target.value)}
          className="w-full h-10 bg-black/40 border border-white/10 rounded-xl px-3 text-xs text-white focus:outline-none focus:border-blue-500/30"
        >
          <option value="en">English</option>
          <option value="es">Español</option>
          <option value="fr">Français</option>
          <option value="de">Deutsch</option>
          <option value="ja">日本語</option>
          <option value="zh">中文</option>
          <option value="hi">हिन्दी</option>
        </select>
      </motion.div>

      {/* Notifications */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="p-5 rounded-2xl bg-white/[0.02] border border-white/5"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Bell size={18} className="text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Notifications</h3>
              <p className="text-[11px] text-zinc-500">Alert on mission completion, approvals, errors</p>
            </div>
          </div>
          <button
            onClick={() => setNotifications(!notifications)}
            className={`w-12 h-6 rounded-full transition-colors relative ${notifications ? 'bg-amber-500' : 'bg-zinc-700'}`}
          >
            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${notifications ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
        </div>
      </motion.div>

      {/* Cost Tracking */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="p-5 rounded-2xl bg-white/[0.02] border border-white/5"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <DollarSign size={18} className="text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Cost Tracking</h3>
              <p className="text-[11px] text-zinc-500">30-day LLM usage and spend</p>
            </div>
          </div>
          <button
            onClick={refreshCosts}
            disabled={loading}
            className="p-2 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors text-zinc-400"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {costData ? (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="p-3 rounded-xl bg-black/30 border border-white/5 text-center">
              <div className="text-lg font-black text-white">{costData.totalCalls.toLocaleString()}</div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Calls</div>
            </div>
            <div className="p-3 rounded-xl bg-black/30 border border-white/5 text-center">
              <div className="text-lg font-black text-white">{(costData.totalTokens / 1000).toFixed(1)}k</div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Tokens</div>
            </div>
            <div className="p-3 rounded-xl bg-black/30 border border-white/5 text-center">
              <div className="text-lg font-black text-emerald-400">${costData.totalCost.toFixed(4)}</div>
              <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Cost</div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-zinc-700">
            <DollarSign size={24} className="mx-auto mb-2" />
            <p className="text-[10px] uppercase tracking-widest font-bold">No cost data available</p>
          </div>
        )}

        {costData && Object.keys(costData.byAgent).length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">By Agent</p>
            {Object.entries(costData.byAgent).map(([agent, stats]) => (
              <div key={agent} className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] border border-white/5">
                <span className="text-xs text-zinc-400 font-mono">{agent}</span>
                <div className="flex items-center gap-4">
                  <span className="text-[10px] text-zinc-500">{stats.calls} calls</span>
                  <span className="text-[10px] text-zinc-500">{(stats.tokens / 1000).toFixed(1)}k tokens</span>
                  <span className="text-[10px] text-emerald-400 font-bold">${stats.cost.toFixed(4)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
