import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Copy, Edit2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useNexusStore } from '../../../store/nexusStore';
import { DocumentEditor } from '../DocumentEditor';

export function DocumentSection({ workspaceId, section }: { workspaceId: string, section: any }) {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(section.content);
  const updateSection = useNexusStore(s => s.updateSectionContent);

  const handleSave = (newContent: string) => {
    setContent(newContent);
    updateSection(workspaceId, section.id, newContent);
    setIsEditing(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
  };

  return (
    <div className="group rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 transition-all hover:border-zinc-700">
      <AnimatePresence>
        {isEditing && (
          <DocumentEditor 
            title={section.title}
            initialContent={content}
            onClose={() => setIsEditing(false)}
            onSave={handleSave}
          />
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between mb-4 pb-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-violet-500/10 flex items-center justify-center text-violet-400">
            <FileText size={16} />
          </div>
          <div>
            <h3 className="font-semibold text-zinc-100">{section.title}</h3>
            {section.description && <p className="text-xs text-zinc-500">{section.description}</p>}
          </div>
        </div>
        
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={handleCopy} className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors" title="Copy Text">
            <Copy size={14} />
          </button>
          <button onClick={() => setIsEditing(true)} className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors" title="Edit">
            <Edit2 size={14} />
          </button>
        </div>
      </div>

      <div className="prose prose-invert prose-sm max-w-none">
        <div className="text-zinc-300 leading-relaxed whitespace-pre-wrap">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

