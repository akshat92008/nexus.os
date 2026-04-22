'use client';

import { Table, Download } from 'lucide-react';

export function TableSection({ workspaceId, section }: { workspaceId: string, section: any }) {
  const leads = section.content || [];
  
  const handleExportCSV = () => {
    if (!leads.length) return;
    const headers = Object.keys(leads[0]).join(',');
    const rows = leads.map((l: any) => Object.values(l).map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const csv = [headers, ...rows].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexus_export_${workspaceId.slice(0, 8)}.csv`;
    a.click();
  };

  if (!leads.length) return null;
  const columns = Object.keys(leads[0]).filter(k => k !== 'dataSource' && k !== 'verificationNote');

  return (
    <div className="group rounded-xl border border-zinc-800 bg-zinc-900/40 transition-all hover:border-zinc-700 overflow-hidden">
      <div className="flex items-center justify-between p-6 pb-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-cyan-500/10 flex items-center justify-center text-cyan-400">
            <Table size={16} />
          </div>
          <div>
            <h3 className="font-semibold text-zinc-100">{section.title}</h3>
            {section.description && <p className="text-xs text-zinc-500">{section.description}</p>}
          </div>
        </div>
        
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={handleExportCSV} className="flex items-center gap-2 px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 font-medium transition-colors">
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-zinc-500 uppercase bg-zinc-900/80 border-b border-zinc-800">
            <tr>
              {columns.map(col => (
                <th key={col} className="px-6 py-3 font-medium tracking-wider">{col.replace(/([A-Z])/g, ' $1').trim()}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {leads.map((row: any, i: number) => (
              <tr key={i} className="hover:bg-zinc-800/20 transition-colors">
                {columns.map(col => (
                  <td key={col} className="px-6 py-4 text-zinc-300">
                    <div className="max-w-[200px] truncate" title={row[col]}>{row[col] || '-'}</div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
