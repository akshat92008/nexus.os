'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GitPullRequest, MessageSquare, CheckCircle, AlertCircle, FileText, ChevronDown, ChevronRight, Send, Info } from 'lucide-react';

interface ReviewComment {
  id: string;
  file: string;
  line: number;
  severity: 'info' | 'warning' | 'error';
  message: string;
  resolved: boolean;
}

interface ReviewData {
  prUrl: string;
  title: string;
  author: string;
  files: string[];
  comments: ReviewComment[];
  summary: string;
}

export function CodeReviewPanel() {
  const [url, setUrl] = useState('');
  const [review, setReview] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [replyText, setReplyText] = useState<Record<string, string>>({});

  const fetchReview = useCallback(async () => {
    if (!url.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prUrl: url }),
      });
      if (res.ok) {
        const data = await res.json();
        setReview(data);
        setExpandedFiles(new Set(data.files.slice(0, 3)));
      }
    } catch (e) {}
    setLoading(false);
  }, [url]);

  const toggleFile = (f: string) => {
    const next = new Set(expandedFiles);
    if (next.has(f)) next.delete(f); else next.add(f);
    setExpandedFiles(next);
  };

  const resolveComment = (id: string) => {
    if (!review) return;
    setReview({
      ...review,
      comments: review.comments.map(c => c.id === id ? { ...c, resolved: !c.resolved } : c)
    });
  };

  const severityIcon = (s: string) => {
    switch (s) {
      case 'error': return <AlertCircle size={12} className="text-rose-400" />;
      case 'warning': return <AlertCircle size={12} className="text-amber-400" />;
      default: return <Info size={12} className="text-blue-400" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950/40 rounded-3xl border border-white/5 backdrop-blur-3xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="h-14 px-6 flex items-center justify-between bg-white/[0.03] border-b border-white/5 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20">
            <GitPullRequest size={14} className="text-violet-400" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.15em] font-black text-zinc-500">Code Review</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* URL Input */}
        <div className="flex gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste PR URL (GitHub/GitLab)..."
            className="flex-1 h-10 bg-white/5 border border-white/10 rounded-xl px-3 text-xs text-white placeholder:text-zinc-700 focus:outline-none focus:border-violet-500/50"
            onKeyDown={(e) => e.key === 'Enter' && fetchReview()}
          />
          <button
            onClick={fetchReview}
            disabled={loading}
            className="h-10 px-4 bg-violet-500/10 border border-violet-500/20 rounded-xl text-xs font-bold text-violet-400 uppercase tracking-widest hover:bg-violet-500/20 disabled:opacity-30"
          >
            {loading ? '...' : 'Review'}
          </button>
        </div>

        {review && (
          <>
            {/* PR Summary */}
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
              <h3 className="text-sm font-bold text-white mb-1">{review.title}</h3>
              <p className="text-[11px] text-zinc-500">by {review.author}</p>
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">{review.summary}</p>
              <div className="flex gap-3 mt-3">
                <span className="text-[10px] px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {review.comments.filter(c => c.severity === 'info').length} Info
                </span>
                <span className="text-[10px] px-2 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {review.comments.filter(c => c.severity === 'warning').length} Warnings
                </span>
                <span className="text-[10px] px-2 py-1 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  {review.comments.filter(c => c.severity === 'error').length} Errors
                </span>
              </div>
            </div>

            {/* Files */}
            {review.files.map(file => (
              <div key={file} className="rounded-xl bg-white/[0.02] border border-white/5 overflow-hidden">
                <button
                  onClick={() => toggleFile(file)}
                  className="w-full flex items-center gap-2 p-3 text-left hover:bg-white/[0.02]"
                >
                  {expandedFiles.has(file) ? <ChevronDown size={14} className="text-zinc-500" /> : <ChevronRight size={14} className="text-zinc-500" />}
                  <FileText size={14} className="text-zinc-400" />
                  <span className="text-xs font-mono text-zinc-300">{file}</span>
                  <span className="ml-auto text-[10px] text-zinc-600">{review.comments.filter(c => c.file === file).length} comments</span>
                </button>
                <AnimatePresence>
                  {expandedFiles.has(file) && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: 'auto' }}
                      exit={{ height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-3 space-y-2 border-t border-white/5">
                        {review.comments.filter(c => c.file === file).map(comment => (
                          <div
                            key={comment.id}
                            className={`p-3 rounded-lg border ${comment.resolved ? 'opacity-40 border-white/5' : 'border-white/10'}`}
                          >
                            <div className="flex items-start gap-2">
                              {severityIcon(comment.severity)}
                              <div className="flex-1">
                                <p className="text-[11px] text-zinc-300 leading-relaxed">{comment.message}</p>
                                <div className="flex items-center gap-2 mt-2">
                                  <span className="text-[10px] text-zinc-600 font-mono">line {comment.line}</span>
                                  <button
                                    onClick={() => resolveComment(comment.id)}
                                    className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                                  >
                                    <CheckCircle size={10} />
                                    {comment.resolved ? 'Reopen' : 'Resolve'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
