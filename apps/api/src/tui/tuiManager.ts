/**
 * Nexus OS — TUI (Terminal User Interface) Manager
 * Inspired by OpenClaw's terminal-first design
 */
import { logger } from '../logger.js';
import { eventBus } from '../events/eventBus.js';
import { getSupabase } from '../storage/supabaseClient.js';

export interface TUIScreen {
  id: string;
  title: string;
  type: 'dashboard' | 'agents' | 'missions' | 'skills' | 'memory' | 'channels' | 'logs' | 'settings';
  components: TUIComponent[];
  refreshInterval?: number; // ms
  hotkeys: Record<string, string>;
}

export interface TUIComponent {
  id: string;
  type: 'header' | 'list' | 'table' | 'chart' | 'status-bar' | 'input' | 'log-viewer' | 'progress';
  data: any;
  style: Record<string, any>;
  updateInterval?: number;
}

export interface TUINotification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'agent' | 'channel';
  message: string;
  source: string;
  timestamp: Date;
  dismissAfter?: number; // ms
}

class TUIManager {
  private activeScreen: string = 'dashboard';
  private screens: Map<string, TUIScreen> = new Map();
  private notifications: TUINotification[] = [];
  private isActive: boolean = false;
  private renderInterval?: NodeJS.Timeout;

  async initialize() {
    logger.info('[TUIManager] Initializing TUI system...');
    
    this.setupDefaultScreens();
    this.subscribeToEvents();
    
    logger.info('[TUIManager] TUI ready. Press Ctrl+Shift+T to toggle.');
  }

  private setupDefaultScreens() {
    this.screens.set('dashboard', {
      id: 'dashboard',
      title: 'Nexus OS — Dashboard',
      type: 'dashboard',
      components: [
        { id: 'header', type: 'header', data: { title: 'Nexus OS v6.0 — AI Employee' }, style: {} },
        { id: 'status', type: 'status-bar', data: {}, style: {}, updateInterval: 1000 },
        { id: 'agents', type: 'list', data: { label: 'Active Agents' }, style: {}, updateInterval: 5000 },
        { id: 'missions', type: 'list', data: { label: 'Recent Missions' }, style: {}, updateInterval: 5000 },
        { id: 'channels', type: 'list', data: { label: 'Channel Status' }, style: {}, updateInterval: 10000 },
        { id: 'notifications', type: 'log-viewer', data: { label: 'Notifications', maxLines: 10 }, style: {} }
      ],
      hotkeys: {
        '1': 'agents',
        '2': 'missions',
        '3': 'skills',
        '4': 'memory',
        '5': 'channels',
        'q': 'quit',
        '?': 'help'
      }
    });

    this.screens.set('agents', {
      id: 'agents',
      title: 'Active Agents',
      type: 'agents',
      components: [
        { id: 'list', type: 'table', data: { columns: ['ID', 'Name', 'Status', 'Type', 'Uptime'] }, style: {}, updateInterval: 2000 },
        { id: 'details', type: 'log-viewer', data: { label: 'Agent Logs' }, style: {} }
      ],
      hotkeys: { 's': 'spawn', 'k': 'kill', 'p': 'pause', 'r': 'resume', 'q': 'back' }
    });

    this.screens.set('missions', {
      id: 'missions',
      title: 'Mission Control',
      type: 'missions',
      components: [
        { id: 'list', type: 'table', data: { columns: ['ID', 'Goal', 'Status', 'Progress', 'Started'] }, style: {}, updateInterval: 3000 },
        { id: 'detail', type: 'log-viewer', data: { label: 'Mission Log' }, style: {} }
      ],
      hotkeys: { 'n': 'new', 'c': 'cancel', 'd': 'details', 'q': 'back' }
    });

    this.screens.set('skills', {
      id: 'skills',
      title: 'Skills & Plugins',
      type: 'skills',
      components: [
        { id: 'list', type: 'table', data: { columns: ['ID', 'Name', 'Type', 'Status', 'Tools'] }, style: {}, updateInterval: 10000 },
        { id: 'detail', type: 'log-viewer', data: { label: 'Skill Info' }, style: {} }
      ],
      hotkeys: { 'i': 'install', 'u': 'uninstall', 'e': 'execute', 'q': 'back' }
    });

    this.screens.set('memory', {
      id: 'memory',
      title: 'Semantic Memory',
      type: 'memory',
      components: [
        { id: 'search', type: 'input', data: { label: 'Search', placeholder: 'Query memories...' }, style: {} },
        { id: 'results', type: 'table', data: { columns: ['Type', 'Content', 'Score', 'Age'] }, style: {} }
      ],
      hotkeys: { '/': 'search', 's': 'store', 'd': 'delete', 'q': 'back' }
    });

    this.screens.set('channels', {
      id: 'channels',
      title: 'Channel Management',
      type: 'channels',
      components: [
        { id: 'list', type: 'table', data: { columns: ['Type', 'Name', 'Status', 'Messages'] }, style: {}, updateInterval: 5000 },
        { id: 'chat', type: 'log-viewer', data: { label: 'Recent Messages' }, style: {} }
      ],
      hotkeys: { 'c': 'connect', 'd': 'disconnect', 's': 'send', 'q': 'back' }
    });

    this.screens.set('logs', {
      id: 'logs',
      title: 'System Logs',
      type: 'logs',
      components: [
        { id: 'filter', type: 'input', data: { label: 'Filter', placeholder: 'log level or keyword...' }, style: {} },
        { id: 'output', type: 'log-viewer', data: { label: 'Live Logs', maxLines: 50 }, style: {}, updateInterval: 500 }
      ],
      hotkeys: { 'f': 'filter', 'c': 'clear', 'q': 'back' }
    });
  }

  private subscribeToEvents() {
    // Listen for real-time events and queue notifications
    eventBus.subscribe('agent_spawned', (e: any) => {
      this.pushNotification({
        id: randomUUID(),
        type: 'agent',
        message: `Agent spawned: ${e.name || e.sessionId}`,
        source: 'agent_system',
        timestamp: new Date(),
        dismissAfter: 5000
      });
    });

    eventBus.subscribe('channel_message', (e: any) => {
      this.pushNotification({
        id: randomUUID(),
        type: 'channel',
        message: `Message from ${e.senderName}: ${e.content?.slice(0, 50)}`,
        source: e.channelType || 'channel',
        timestamp: new Date(),
        dismissAfter: 3000
      });
    });

    eventBus.subscribe('mission_complete', (e: any) => {
      this.pushNotification({
        id: randomUUID(),
        type: 'success',
        message: `Mission complete: ${e.goal || e.missionId}`,
        source: 'orchestrator',
        timestamp: new Date(),
        dismissAfter: 8000
      });
    });

    eventBus.subscribe('tool_error', (e: any) => {
      this.pushNotification({
        id: randomUUID(),
        type: 'error',
        message: `Tool error: ${e.error || 'Unknown'}`,
        source: e.toolName || 'tool_executor',
        timestamp: new Date()
      });
    });
  }

  pushNotification(n: TUINotification) {
    this.notifications.push(n);
    // Auto-cleanup
    if (n.dismissAfter) {
      setTimeout(() => this.dismissNotification(n.id), n.dismissAfter);
    }
    // Keep max 100
    if (this.notifications.length > 100) {
      this.notifications = this.notifications.slice(-100);
    }
  }

  dismissNotification(id: string) {
    this.notifications = this.notifications.filter(n => n.id !== id);
  }

  async renderScreen(screenId?: string): Promise<string> {
    const id = screenId || this.activeScreen;
    const screen = this.screens.get(id);
    if (!screen) return `Screen not found: ${id}`;

    // In a real TUI, this would use a library like blessed or ink (React for terminal)
    // For now, return a structured JSON representation
    const data: any = {
      screen: { id: screen.id, title: screen.title, type: screen.type },
      timestamp: new Date().toISOString(),
      components: [],
      notifications: this.notifications.slice(-5),
      hotkeys: screen.hotkeys
    };

    for (const comp of screen.components) {
      data.components.push(await this.renderComponent(comp));
    }

    return JSON.stringify(data, null, 2);
  }

  private async renderComponent(comp: TUIComponent): Promise<any> {
    const base = { id: comp.id, type: comp.type };

    switch (comp.type) {
      case 'header':
        return { ...base, ...comp.data };

      case 'status-bar': {
        const status = {
          system: 'online',
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          cpu: 'unknown',
          version: '6.0.0'
        };
        return { ...base, data: status };
      }

      case 'list': {
        const label = comp.data?.label;
        let items: any[] = [];
        
        if (label === 'Active Agents') {
          const { subAgentManager } = await import('../agents/subAgentManager.js');
          items = (await subAgentManager.listSessions({})).map((s: any) => ({
            name: s.config?.name || s.id,
            status: s.status
          }));
        } else if (label === 'Recent Missions') {
          const supabase = await getSupabase();
          const { data } = await supabase.from('nexus_missions').select('id, goal, status').order('created_at', { ascending: false }).limit(5);
          items = data || [];
        } else if (label === 'Channel Status') {
          const { channelManager } = await import('../channels/channelManager.js');
          items = channelManager.getActiveChannels();
        }

        return { ...base, label, items };
      }

      case 'table': {
        return { ...base, columns: comp.data?.columns || [], rows: [] };
      }

      case 'log-viewer': {
        return { ...base, label: comp.data?.label, lines: [] };
      }

      case 'input': {
        return { ...base, label: comp.data?.label, placeholder: comp.data?.placeholder };
      }

      case 'progress': {
        return { ...base, ...comp.data };
      }

      default:
        return { ...base, ...comp.data };
    }
  }

  switchScreen(screenId: string) {
    if (!this.screens.has(screenId)) {
      logger.warn(`[TUIManager] Unknown screen: ${screenId}`);
      return false;
    }
    this.activeScreen = screenId;
    return true;
  }

  getActiveScreen(): string {
    return this.activeScreen;
  }

  getScreens(): TUIScreen[] {
    return Array.from(this.screens.values());
  }

  getNotifications(): TUINotification[] {
    return this.notifications;
  }

  toggleTUI(): boolean {
    this.isActive = !this.isActive;
    if (this.isActive) {
      logger.info('[TUIManager] TUI activated. Press q to quit, ? for help.');
    } else {
      logger.info('[TUIManager] TUI deactivated.');
    }
    return this.isActive;
  }
}

// Helper
function randomUUID(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

export const tuiManager = new TUIManager();
