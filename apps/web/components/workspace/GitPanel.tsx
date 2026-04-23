'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { GitBranch, GitCommit, GitMerge, RotateCcw, CircleDot, ArrowUpRight, Check, X } from 'lucide-react';

interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  modified: string[];
  staged: string[];
  untracked: string[];
  commits: { hash: string; message: string; author: string; date: string }[];
}

export function GitPanel() {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/git/status');
      if (res.ok) setStatus(await res.json());
    } catch (e) {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const runGit = async (action: string, body?: any) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/git/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
      });
      if (res.ok) await fetchStatus();
    } catch (e) {}
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950/40 rounded-3xl border border-white/5 backdrop-blur-3xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="h-14 px-6 flex items-center justify-between bg-white/[0.03] border-b border-white/5 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20">
            <GitBranch size={14} className="text-orange-400" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.15em] font-black text-zinc-500">Git</div>
          </div>
        </div>
        <button onClick={fetchStatus} className="p-2 hover:bg-white/5 rounded-lg transition-colors text-zinc-500">
          <RotateCcw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {status ? (
          <>
            {/* Branch info */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <GitBranch size={14} className="text-orange-400" />
              <span className="text-xs font-mono text-white">{status.branch}</span>
              <div className="ml-auto flex gap-2">
                {status.ahead > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                    <ArrowUpRight size={10} /> {status.ahead}
                  </span>
                )}
                {status.behind > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    {status.behind} behind
                  </span>
                )}
              </div>
            </div>

            {/* Working tree */}
            <div className="space-y-2">
              <h4 className="text-[10px] uppercase tracking-widest font-black text-zinc-600">Working Tree</h4>
              {status.staged.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">Staged</p>
                  {status.staged.map(f => (
                    <div key={f} className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                      <Check size={10} className="text-emerald-400" />
                      <span className="text-[11px] font-mono text-zinc-300">{f}</span>
                    </div>
                  ))}
                </div>
              )}
              {status.modified.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] text-amber-500 font-bold uppercase tracking-wider">Modified</p>
                  {status.modified.map(f => (
                    <div key={f} className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
                      <CircleDot size={10} className="text-amber-400" />
                      <span className="text-[11px] font-mono text-zinc-300">{f}</span>
                    </div>
                  ))}
                </div>
              )}
              {status.untracked.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Untracked</p>
                  {status.untracked.map(f => (
                    <div key={f} className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/10">
                      <X size={10} className="text-zinc-500" />
                      <span className="text-[11px] font-mono text-zinc-400">{f}</span>
                    </div>
                  ))}
                </div>
              )}
              {status.staged.length === 0 && status.modified.length === 0 && status.untracked.length === 0 && (
                <p className="text-xs text-zinc-600 text-center py-4">Working tree clean</p>
              )}
            </div>

            {/* Commit */}
            {(status.staged.length > 0 || status.modified.length > 0) && (
              <div className="flex gap-2">
                <input
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder="Commit message..."
                  className="flex-1 h-9 bg-white/5 border border-white/10 rounded-lg px-3 text-xs text-white placeholder:text-zinc-700 focus:outline-none"
                  onKeyDown={(e) => e.key === 'Enter' && commitMessage && runGit('commit', { message: commitMessage })}
                />
                <button
                  onClick={() => runGit('commit', { message: commitMessage })}
                  disabled={!commitMessage}
                  className="h-9 px-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-[10px] font-bold text-emerald-400 uppercase tracking-wider hover:bg-emerald-500/20 disabled:opacity-30"
                >
                  <GitCommit size={12} />
                </button>
              </div>
            )}

            {/* Recent commits */}
            <div className="space-y-2">
              <h4 className="text-[10px] uppercase tracking-widest font-black text-zinc-600">Recent Commits</h4>
              {status.commits.map(c => (
                <div key={c.hash} className="p-2 rounded-lg bg-white/[0.02] border border-white/5">
                  <p className="text-[11px] text-zinc-300 truncate">{c.message}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-mono text-zinc-600">{c.hash.slice(0, 7)}</span>
                    <span className="text-[10px] text-zinc-600">{c.author}</span>
                    <span className="text-[10px] text-zinc-700 ml-auto">{c.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-zinc-700">
            <div className="text-center">
              <GitBranch size={24} className="mx-auto mb-2" />
              <p className="text-[10px] uppercase tracking-widest font-bold">No repository detected</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
