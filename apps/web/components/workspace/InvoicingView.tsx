'use client';

import { useNexusStore } from '../../store/nexusStore';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Plus, Search, Filter, MoreHorizontal, Download, Trash2, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { useState } from 'react';

export function InvoicingView() {
  const { invoicing, deleteInvoice, updateInvoiceStatus } = useNexusStore();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredInvoices = invoicing.invoices.filter(inv => 
    inv.client.toLowerCase().includes(searchQuery.toLowerCase()) || 
    inv.number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'text-emerald-400 bg-emerald-400/10 border-emerald-500/20';
      case 'pending': return 'text-amber-400 bg-amber-400/10 border-amber-500/20';
      case 'overdue': return 'text-rose-400 bg-rose-400/10 border-rose-500/20';
      default: return 'text-zinc-400 bg-zinc-400/10 border-zinc-500/20';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return <CheckCircle size={12} />;
      case 'pending': return <Clock size={12} />;
      case 'overdue': return <AlertCircle size={12} />;
      default: return null;
    }
  };

  return (
    <div className="flex-1 max-w-6xl mx-auto w-full flex flex-col gap-8 pb-20 fade-in pt-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100 tracking-tight">Invoicing</h1>
          <p className="text-zinc-500 mt-1">Manage your billings and client payments.</p>
        </div>
        <button className="px-5 py-2.5 rounded-xl bg-violet-600 text-white font-bold text-sm hover:bg-violet-500 transition-all shadow-lg shadow-violet-500/20 flex items-center gap-2">
          <Plus size={18} /> Create Invoice
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-3xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm">
          <div className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500 mb-1">Total Outstanding</div>
          <div className="text-2xl font-bold text-zinc-100">
            ${invoicing.invoices.filter(i => i.status !== 'paid').reduce((acc, i) => acc + i.amount, 0).toLocaleString()}
          </div>
        </div>
        <div className="p-6 rounded-3xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm">
          <div className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500 mb-1">Total Paid (YTD)</div>
          <div className="text-2xl font-bold text-emerald-400">
            ${invoicing.invoices.filter(i => i.status === 'paid').reduce((acc, i) => acc + i.amount, 0).toLocaleString()}
          </div>
        </div>
        <div className="p-6 rounded-3xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm">
          <div className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500 mb-1">Overdue Amount</div>
          <div className="text-2xl font-bold text-rose-400">
            ${invoicing.invoices.filter(i => i.status === 'overdue').reduce((acc, i) => acc + i.amount, 0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-violet-400 transition-colors" size={18} />
          <input 
            type="text" 
            placeholder="Search by invoice number or client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900/40 border border-zinc-800 rounded-2xl py-3 pl-12 pr-4 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-violet-500/50 transition-all"
          />
        </div>
        <button className="p-3 rounded-2xl bg-zinc-800 text-zinc-400 hover:text-white transition-colors border border-zinc-700">
          <Filter size={18} />
        </button>
      </div>

      {/* Invoices Table */}
      <div className="rounded-3xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-950/50">
              <th className="px-6 py-4 text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500">Invoice</th>
              <th className="px-6 py-4 text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500">Client</th>
              <th className="px-6 py-4 text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500">Amount</th>
              <th className="px-6 py-4 text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500">Status</th>
              <th className="px-6 py-4 text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500">Due Date</th>
              <th className="px-6 py-4 text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence mode="popLayout">
              {filteredInvoices.map((inv) => (
                <motion.tr
                  key={inv.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-all group"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-zinc-800 text-zinc-500 group-hover:text-violet-400 transition-colors">
                        <FileText size={16} />
                      </div>
                      <span className="text-sm font-bold text-zinc-200">{inv.number}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-400">{inv.client}</td>
                  <td className="px-6 py-4 text-sm font-bold text-zinc-100">${inv.amount.toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border flex items-center gap-1.5 w-fit ${getStatusColor(inv.status)}`}>
                      {getStatusIcon(inv.status)}
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-zinc-500">{new Date(inv.dueDate).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                      <button className="p-2 text-zinc-500 hover:text-white transition-colors"><Download size={16} /></button>
                      <button onClick={() => deleteInvoice(inv.id)} className="p-2 text-zinc-500 hover:text-rose-400 transition-colors"><Trash2 size={16} /></button>
                      <button className="p-2 text-zinc-500 hover:text-white transition-colors"><MoreHorizontal size={16} /></button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
        
        {filteredInvoices.length === 0 && (
          <div className="p-20 text-center">
            <FileText size={48} className="mx-auto text-zinc-800 mb-4" />
            <p className="text-zinc-500 font-medium">No invoices found matching your search.</p>
          </div>
        )}
      </div>
    </div>
  );
}
