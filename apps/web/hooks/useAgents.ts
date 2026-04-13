import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../lib/supabase';
import { useNexusStore } from '../store/nexusStore';
import { 
  Search, 
  Activity, 
  PenTool, 
  Code, 
  Target, 
  Zap, 
  Sparkles, 
  Globe 
} from 'lucide-react';

const ICON_MAP: Record<string, any> = {
  'Search': Search,
  'Activity': Activity,
  'PenTool': PenTool,
  'Code': Code,
  'Target': Target,
  'Zap': Zap,
  'Sparkles': Sparkles,
  'Globe': Globe,
};

export function useAgents(activeCategory: string, searchQuery: string) {
  const { installedAgentIds, installAgent } = useNexusStore();
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Authentication required');

      const response = await fetch('/api/agents', {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Failed to load agents');

      setAgents(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load agents');
    } finally {
      setLoading(false);
    }
  }, []);

  const mappedAgents = agents.map(a => ({
    ...a,
    icon: ICON_MAP[a.icon] || Sparkles,
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    installed: (installedAgentIds || []).includes(a.id),
    rating: 4.8 + (Math.random() * 0.2),
    users: Math.floor(Math.random() * 10) + 'k',
  }));

  const filteredAgents = mappedAgents.filter(agent => {
    const matchesCategory = activeCategory === 'All' || 
                           agent.category.toLowerCase() === activeCategory.toLowerCase();
    const matchesSearch = agent.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         agent.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return {
    agents: filteredAgents,
    loading,
    error,
    refresh: fetchAgents,
    installAgent
  };
}
