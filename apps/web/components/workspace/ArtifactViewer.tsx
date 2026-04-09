'use client';

/**
 * Nexus OS — Artifact Viewer
 *
 * When an agent card is clicked in the Task Manager, the full artifact
 * content opens here as a "document window" in the OS canvas.
 * Includes export controls (Markdown, JSON, PDF) that call the API
 * and trigger a browser download.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, FileText, FileJson, FileCode2, ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { useNexusStore } from '../../store/nexusStore';
import { exportArtifact } from '../../lib/exportArtifact';
import type { ExportFormat } from '@nexus-os/types';

const EXPORT_OPTIONS: { format: ExportFormat; label: string; icon: React.ReactNode }[] = [
  { format: 'markdown', label: 'Report (MD)', icon: <FileText size={12} /> },
  { format: 'excel',    label: 'Excel (CSV)', icon: <FileCode2 size={12} /> }, // Using FileCode2 as a placeholder for spreadsheet icon
  { format: 'pdf',      label: 'PDF (Print)', icon: <Download size={12} /> },
  { format: 'json',     label: 'JSON',        icon: <FileJson size={12} /> },
];


export function ArtifactViewer() {
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const activeId      = useNexusStore((s) => s.ui.activeArtifactId);
  const setActiveId   = useNexusStore((s) => s.setActiveArtifact);
  const artifacts     = useNexusStore((s) => s.artifacts);
  const sessionId     = useNexusStore((s) => s.session.id);

  const artifact = activeId ? artifacts.get(activeId) : null;

  const handleExport = async (format: ExportFormat) => {
    if (!sessionId) return;
    setExporting(format);
    setExportError(null);
    try {
      await exportArtifact(sessionId, format);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(null);
    }
  };

  return (
    <AnimatePresence>
      {artifact && (
        <motion.div
          key={activeId}
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 400, damping: 35 }}
          className="absolute inset-4 z-20 rounded-2xl border border-slate-700/60
                     bg-slate-950/95 backdrop-blur-xl flex flex-col overflow-hidden
                     shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
        >
          {/* Titlebar */}
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-800/60">
            {/* macOS-style window buttons */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setActiveId(null)}
                className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 transition-colors"
              />
              <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
              <div className="w-3 h-3 rounded-full bg-green-500/60" />
            </div>

            <div className="flex-1 flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-300">
                {artifact.taskLabel}
              </span>
              <span className="text-[10px] text-slate-600 font-mono">
                {artifact.agentType} · {artifact.tokensUsed} tokens
              </span>
            </div>

            {/* Export controls */}
            <div className="flex items-center gap-1.5">
              {EXPORT_OPTIONS.map(({ format, label, icon }) => (
                <button
                  key={format}
                  onClick={() => handleExport(format)}
                  disabled={!!exporting}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60
                             px-2.5 py-1 text-[10px] text-slate-400 transition-all
                             hover:border-slate-500 hover:text-slate-200
                             disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {exporting === format ? (
                    <span className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    icon
                  )}
                  {label}
                </button>
              ))}
            </div>

            <button
              onClick={() => setActiveId(null)}
              className="rounded-lg p-1.5 text-slate-600 hover:text-slate-400 transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <pre className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap font-mono">
              {artifact.content}
            </pre>
          </div>

          {/* Export error */}
          {exportError && (
            <div className="mx-5 mb-4 px-4 py-2.5 rounded-xl text-xs text-red-400
                           border border-red-500/30 bg-red-950/30">
              {exportError}
            </div>
          )}

          {/* Footer */}
          <div className="px-5 py-3 border-t border-slate-800/60 flex items-center justify-between">
            <span className="text-[10px] text-slate-600 font-mono">
              Agent: {artifact.agentId} · {artifact.depositedAt}
            </span>
            <button
              onClick={() => setActiveId(null)}
              className="flex items-center gap-1 text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
            >
              <ArrowLeft size={10} />
              Back to workspace
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
