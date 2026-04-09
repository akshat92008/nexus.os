'use client';

import { useNexusStore } from '../../store/nexusStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Clock, MapPin, Users, Video } from 'lucide-react';
import { useState } from 'react';

export function CalendarView() {
  const { calendar, deleteCalendarEvent } = useNexusStore();
  const [selectedDate, setSelectedDate] = useState(new Date());

  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getEventStyle = (event: any) => {
    const start = new Date(event.startTime);
    const end = new Date(event.endTime);
    const startHour = start.getHours() + start.getMinutes() / 60;
    const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    
    return {
      top: `${startHour * 64}px`,
      height: `${duration * 64}px`,
    };
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'meeting': return 'bg-violet-500/20 border-violet-500/50 text-violet-300';
      case 'task': return 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300';
      case 'reminder': return 'bg-amber-500/20 border-amber-500/50 text-amber-300';
      default: return 'bg-zinc-500/20 border-zinc-500/50 text-zinc-300';
    }
  };

  return (
    <div className="flex-1 max-w-6xl mx-auto w-full flex flex-col gap-6 pb-20 fade-in pt-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold text-zinc-100 tracking-tight">Calendar</h1>
          <div className="flex items-center gap-2 bg-zinc-900/60 border border-zinc-800 rounded-xl px-3 py-1.5">
            <button className="p-1 hover:text-white text-zinc-500 transition-colors"><ChevronLeft size={16} /></button>
            <span className="text-sm font-bold text-zinc-200 min-w-[120px] text-center">
              {selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
            <button className="p-1 hover:text-white text-zinc-500 transition-colors"><ChevronRight size={16} /></button>
          </div>
        </div>
        <button className="px-5 py-2.5 rounded-xl bg-violet-600 text-white font-bold text-sm hover:bg-violet-500 transition-all shadow-lg shadow-violet-500/20 flex items-center gap-2">
          <Plus size={18} /> New Event
        </button>
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Day View */}
        <div className="flex-1 bg-zinc-900/40 border border-zinc-800 rounded-[32px] backdrop-blur-sm overflow-y-auto custom-scrollbar relative">
          <div className="flex">
            {/* Time Column */}
            <div className="w-20 border-r border-zinc-800/50">
              {hours.map(h => (
                <div key={h} className="h-16 border-b border-zinc-800/30 text-[10px] font-bold text-zinc-600 flex items-start justify-center pt-2 uppercase tracking-widest">
                  {h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h-12} PM`}
                </div>
              ))}
            </div>

            {/* Events Grid */}
            <div className="flex-1 relative">
              {hours.map(h => (
                <div key={h} className="h-16 border-b border-zinc-800/30 w-full" />
              ))}
              
              <AnimatePresence>
                {calendar.events.map(event => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    style={getEventStyle(event)}
                    className={`absolute left-2 right-4 rounded-xl border p-3 flex flex-col gap-1 shadow-lg backdrop-blur-md cursor-pointer hover:scale-[1.01] transition-transform z-10 ${getEventColor(event.type)}`}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold truncate">{event.title}</h4>
                      <Clock size={12} className="opacity-60" />
                    </div>
                    <div className="text-[10px] opacity-80 flex items-center gap-1">
                      {new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - 
                      {new Date(event.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {event.location && (
                      <div className="text-[10px] opacity-80 flex items-center gap-1 mt-1 truncate">
                        {event.location.includes('http') ? <Video size={10} /> : <MapPin size={10} />}
                        {event.location}
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {/* Current Time Indicator */}
              <div 
                className="absolute left-0 right-0 border-t-2 border-rose-500 z-20 pointer-events-none"
                style={{ top: `${(new Date().getHours() + new Date().getMinutes() / 60) * 64}px` }}
              >
                <div className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-rose-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-80 flex flex-col gap-6">
          {/* Upcoming */}
          <div className="p-6 rounded-3xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm">
            <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2 mb-4">
              <Clock size={16} /> Upcoming Today
            </h3>
            <div className="space-y-4">
              {calendar.events.slice(0, 3).map(event => (
                <div key={event.id} className="group cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className={`w-1 h-8 rounded-full ${event.type === 'meeting' ? 'bg-violet-500' : 'bg-cyan-500'}`} />
                    <div>
                      <h4 className="text-sm font-bold text-zinc-200 group-hover:text-violet-400 transition-colors line-clamp-1">{event.title}</h4>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">
                        {new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mini Calendar Placeholder */}
          <div className="p-6 rounded-3xl border border-zinc-800 bg-zinc-900/40 backdrop-blur-sm flex-1">
            <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2 mb-4">
              <CalendarIcon size={16} /> Quick Select
            </h3>
            <div className="grid grid-cols-7 gap-2">
              {['S','M','T','W','T','F','S'].map(d => (
                <div key={d} className="text-[10px] font-black text-zinc-600 text-center">{d}</div>
              ))}
              {Array.from({ length: 31 }, (_, i) => (
                <button 
                  key={i} 
                  className={`aspect-square rounded-lg flex items-center justify-center text-[10px] font-bold transition-all ${
                    i + 1 === new Date().getDate() 
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/20' 
                    : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
