/**
 * Nexus OS — Daemon Mode & Service Management
 * Run as background service, auto-start on boot, health monitoring
 * Inspired by OpenClaw's daemon architecture
 */
import { logger } from '../logger.js';
import { eventBus } from '../events/eventBus.js';
import { randomUUID } from 'crypto';
import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

export interface DaemonConfig {
  autoStart: boolean;
  restartOnCrash: boolean;
  maxRestarts: number;
  healthCheckInterval: number; // ms
  logRetentionDays: number;
  watchPaths: string[];
  envVars: Record<string, string>;
}

export interface DaemonStatus {
  pid: number;
  uptime: number;
  status: 'running' | 'restarting' | 'stopped' | 'error';
  startTime: Date;
  lastHealthCheck: Date;
  restartCount: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: { user: number; system: number };
  activeConnections: number;
  queuedTasks: number;
}

class DaemonManager {
  private config: DaemonConfig;
  private status: DaemonStatus | null = null;
  private healthInterval?: NodeJS.Timeout;
  private restartCount: number = 0;
  private isDaemon: boolean = false;
  private launchedAtBoot: boolean = false;

  constructor() {
    this.config = {
      autoStart: false,
      restartOnCrash: true,
      maxRestarts: 5,
      healthCheckInterval: 30000,
      logRetentionDays: 7,
      watchPaths: [],
      envVars: {}
    };
  }

  async initialize() {
    logger.info('[DaemonManager] Initializing daemon system...');

    // Detect if running as daemon
    this.isDaemon = process.env.NEXUS_DAEMON === '1' || process.env.NODE_ENV === 'production';
    
    if (this.isDaemon) {
      logger.info('[DaemonManager] Running in daemon mode');
      await this.startHealthMonitoring();
    }

    // Check if launched at boot (macOS launchd)
    this.launchedAtBoot = process.env.LAUNCHD === '1' || process.platform === 'darwin' && process.ppid === 1;

    logger.info(`[DaemonManager] Daemon ready (daemon=${this.isDaemon}, boot=${this.launchedAtBoot})`);
  }

  async startHealthMonitoring() {
    this.status = {
      pid: process.pid,
      uptime: 0,
      status: 'running',
      startTime: new Date(),
      lastHealthCheck: new Date(),
      restartCount: 0,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      activeConnections: 0,
      queuedTasks: 0
    };

    this.healthInterval = setInterval(() => {
      this.runHealthCheck();
    }, this.config.healthCheckInterval);

    logger.info('[DaemonManager] Health monitoring started');
  }

  private async runHealthCheck() {
    if (!this.status) return;

    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage(this.status.cpuUsage);
    const uptime = (Date.now() - this.status.startTime.getTime()) / 1000;

    this.status = {
      ...this.status,
      uptime,
      lastHealthCheck: new Date(),
      memoryUsage: memUsage,
      cpuUsage: { user: cpuUsage.user, system: cpuUsage.system }
    };

    // Memory leak detection
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    const rssMB = memUsage.rss / 1024 / 1024;

    if (heapUsedMB > 1024) { // 1GB heap
      logger.warn(`[DaemonManager] High heap usage: ${Math.round(heapUsedMB)}MB. Consider restart.`);
      eventBus.publish('daemon_warning', {
        type: 'memory',
        heapMB: heapUsedMB,
        rssMB,
        message: 'High memory usage detected'
      }).catch(() => {});
    }

    // Log status
    logger.debug({ 
      uptime: Math.round(uptime),
      memoryMB: Math.round(rssMB),
      connections: this.status.activeConnections 
    }, '[DaemonManager] Health check');
  }

  async installLaunchAgent(): Promise<boolean> {
    if (process.platform !== 'darwin') {
      logger.warn('[DaemonManager] Launch agent installation only supported on macOS');
      return false;
    }

    const plistPath = path.join(os.homedir(), 'Library', 'LaunchAgents', 'com.nexus-os.agent.plist');
    
    const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.nexus-os.agent</string>
  <key>ProgramArguments</key>
  <array>
    <string>${process.execPath}</string>
    <string>${process.argv[1] || path.join(process.cwd(), 'dist', 'index.js')}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${path.join(os.homedir(), 'Library', 'Logs', 'nexus-os.log')}</string>
  <key>StandardErrorPath</key>
  <string>${path.join(os.homedir(), 'Library', 'Logs', 'nexus-os-error.log')}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>NEXUS_DAEMON</key>
    <string>1</string>
    <key>LAUNCHD</key>
    <string>1</string>
  </dict>
</dict>
</plist>`;

    try {
      await fs.mkdir(path.dirname(plistPath), { recursive: true });
      await fs.writeFile(plistPath, plist, 'utf-8');
      
      // Load the launch agent
      const { execFile } = await import('child_process');
      const { promisify } = await import('util');
      await promisify(execFile)('launchctl', ['load', plistPath]);
      
      logger.info(`[DaemonManager] Launch agent installed: ${plistPath}`);
      return true;
    } catch (err: any) {
      logger.error(`[DaemonManager] Failed to install launch agent: ${err.message}`);
      return false;
    }
  }

  async uninstallLaunchAgent(): Promise<boolean> {
    if (process.platform !== 'darwin') return false;

    const plistPath = path.join(os.homedir(), 'Library', 'LaunchAgents', 'com.nexus-os.agent.plist');
    
    try {
      const { execFile } = await import('child_process');
      const { promisify } = await import('util');
      await promisify(execFile)('launchctl', ['unload', plistPath]);
      await fs.unlink(plistPath);
      
      logger.info('[DaemonManager] Launch agent uninstalled');
      return true;
    } catch (err: any) {
      logger.error(`[DaemonManager] Failed to uninstall: ${err.message}`);
      return false;
    }
  }

  async startDaemon(): Promise<boolean> {
    if (this.isDaemon) {
      logger.info('[DaemonManager] Already running as daemon');
      return true;
    }

    // Fork self as daemon
    const scriptPath = process.argv[1] || path.join(process.cwd(), 'dist', 'index.js');
    
    const child = spawn(process.execPath, [scriptPath], {
      detached: true,
      stdio: 'ignore',
      env: {
        ...process.env,
        NEXUS_DAEMON: '1'
      }
    });

    child.unref();

    logger.info(`[DaemonManager] Daemon started with PID ${child.pid}`);
    return true;
  }

  async stopDaemon(): Promise<boolean> {
    if (!this.isDaemon) {
      logger.warn('[DaemonManager] Not running as daemon');
      return false;
    }

    logger.info('[DaemonManager] Stopping daemon...');
    
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
    }

    // Graceful shutdown
    eventBus.publish('daemon_shutdown', { 
      timestamp: new Date(),
      uptime: this.status?.uptime || 0
    }).catch(() => {});

    // Allow time for cleanup
    setTimeout(() => {
      process.exit(0);
    }, 2000);

    return true;
  }

  getStatus(): DaemonStatus | null {
    return this.status;
  }

  isRunningAsDaemon(): boolean {
    return this.isDaemon;
  }

  wasLaunchedAtBoot(): boolean {
    return this.launchedAtBoot;
  }

  setConfig(config: Partial<DaemonConfig>) {
    this.config = { ...this.config, ...config };
    
    // Restart health monitoring if interval changed
    if (this.healthInterval && this.isDaemon) {
      clearInterval(this.healthInterval);
      this.startHealthMonitoring();
    }
  }

  getConfig(): DaemonConfig {
    return { ...this.config };
  }
}

export const daemonManager = new DaemonManager();
