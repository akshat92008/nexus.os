'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Mail, Calendar, Database, MessageSquare, FileText, 
  Github, Link, Check, AlertCircle, ExternalLink 
} from 'lucide-react';

interface Integration {
  id: string;
  type: string;
  account_email?: string;
  account_name?: string;
  connected_at: string;
  is_active: boolean;
  scopes: string[];
}

const INTEGRATION_CONFIG = [
  { type: 'gmail', name: 'Gmail', icon: Mail, color: 'text-red-400', description: 'Read, draft, send emails' },
  { type: 'calendar', name: 'Google Calendar', icon: Calendar, color: 'text-blue-400', description: 'Schedule meetings, check availability' },
  { type: 'hubspot', name: 'HubSpot', icon: Database, color: 'text-orange-400', description: 'CRM, deals, contacts' },
  { type: 'slack', name: 'Slack', icon: MessageSquare, color: 'text-purple-400', description: 'Messages, channels, DMs' },
  { type: 'notion', name: 'Notion', icon: FileText, color: 'text-zinc-100', description: 'Pages, databases, notes' },
  { type: 'github', name: 'GitHub', icon: Github, color: 'text-slate-300', description: 'Repos, PRs, issues' },
];

export function IntegrationsView() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/integrations')
      .then(r => r.json())
      .then(data => {
        setIntegrations(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(e => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  const isConnected = (type: string) => integrations.some(i => i.integration_type === type && i.is_active);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-white tracking-tight">Integrations</h2>
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-widest">
          {integrations.length} Connected
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {INTEGRATION_CONFIG.map((config) => {
          const connected = isConnected(config.type);
          const integration = integrations.find(i => i.integration_type === config.type);
          
          return (
            <motion.div
              key={config.type}
              whileHover={{ scale: 1.01 }}
              className={`relative p-5 rounded-2xl border transition-all ${
                connected 
                  ? 'bg-emerald-950/20 border-emerald-500/20' 
                  : 'bg-white/[0.02] border-white/5 hover:border-white/10'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0 ${config.color}`}>
                  <config.icon size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">{config.name}</h3>
                    {connected && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                        <Check size={10} /> Connected
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">{config.description}</p>
                  {integration && (
                    <p className="text-[10px] text-zinc-600 mt-2 font-mono">
                      {integration.account_email || integration.account_name}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="mt-4 flex items-center gap-2">
                <button
                  className={`flex-1 h-9 rounded-xl text-xs font-bold transition-all ${
                    connected
                      ? 'bg-white/5 text-zinc-400 hover:text-white'
                      : 'bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20'
                  }`}
                >
                  {connected ? 'Manage' : 'Connect'}
                </button>
                {!connected && (
                  <a 
                    href={`/api/auth/${config.type}`}
                    className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-zinc-500 hover:text-white transition-colors"
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-red-950/20 border border-red-500/20 text-red-400 text-xs">
          <AlertCircle size={14} /> {error}
        </div>
      )}
    </div>
  );
}
