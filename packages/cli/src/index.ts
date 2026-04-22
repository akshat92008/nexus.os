#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const program = new Command();
const CONFIG = path.join(os.homedir(), '.nexus', 'config.json');

async function loadConfig() {
  try { return JSON.parse(await fs.readFile(CONFIG, 'utf-8')); }
  catch { return { apiUrl: 'http://localhost:3006' }; }
}

async function api(endpoint: string, opts: RequestInit = {}) {
  const c = await loadConfig();
  const r = await fetch(c.apiUrl + endpoint, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...opts.headers }
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
  return r.json();
}

program.name('nexus').description('Nexus OS CLI - Your AI Employee');

program.command('onboard').description('Setup wizard').action(async () => {
  console.log(chalk.cyan('\n🚀 Nexus OS Setup\n'));
  const answers = { apiUrl: 'http://localhost:3006', model: 'llama-3.3-70b' };
  await fs.mkdir(path.dirname(CONFIG), { recursive: true });
  await fs.writeFile(CONFIG, JSON.stringify(answers, null, 2));
  console.log(chalk.green('✅ Config saved'));
});

program.command('ask <msg>').description('Ask your AI employee')
  .option('-s, --skills <list>', 'Skills', '')
  .action(async (msg, opts) => {
    console.log(chalk.cyan('🤖 Spawning agent...'));
    const r = await api('/api/subagents/spawn', {
      method: 'POST',
      body: JSON.stringify({ name: 'CLI', description: 'CLI query', message: msg, skills: opts.skills ? opts.skills.split(',') : [] })
    });
    console.log(chalk.green('Agent:'), r.sessionId);
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const s = await api(`/api/subagents/${r.sessionId}`);
      if (s.status === 'completed') { console.log(chalk.green('\n✅'), s.output); return; }
      if (s.status === 'failed') { console.log(chalk.red('\n❌'), s.error); return; }
      process.stdout.write('.');
    }
  });

program.command('channels list').description('List channels').action(async () => {
  const ch = await api('/api/channels');
  console.log(chalk.cyan('\n📡 Channels\n'));
  ch.forEach((c: any) => console.log(`  ${c.type} ${c.name} ${c.isActive ? chalk.green('●') : chalk.gray('○')}`));
});

program.command('agents list').description('List agents').action(async () => {
  const a = await api('/api/subagents');
  console.log(chalk.cyan('\n🤖 Agents\n'));
  a.forEach((ag: any) => console.log(`  ${ag.config?.name || ag.id} ${ag.status}`));
});

program.command('memory search <query>').description('Search memories').action(async (q) => {
  const r = await api('/api/memory/search', { method: 'POST', body: JSON.stringify({ query: q, limit: 10 }) });
  console.log(chalk.cyan(`\n🧠 ${r.length} results\n`));
  r.slice(0, 5).forEach((m: any) => console.log(`  ${Math.round(m.similarity * 100)}% ${m.memory.content.substring(0, 60)}...`));
});

program.command('tasks list').description('List scheduled tasks').action(async () => {
  const t = await api('/api/tasks');
  console.log(chalk.cyan('\n⏰ Tasks\n'));
  t.forEach((tk: any) => console.log(`  ${tk.name} ${tk.status} ${tk.schedule?.cron || 'one-time'}`));
});

program.command('mcp list').description('List MCP servers').action(async () => {
  const c = await api('/api/mcp/connections');
  console.log(chalk.cyan('\n🔌 MCP Connections\n'));
  c.forEach((m: any) => console.log(`  ${m.config.name} ${m.status} ${m.tools.length} tools`));
});

program.command('status').description('System status').action(async () => {
  const s = await api('/api/health');
  console.log(chalk.cyan('\n🛰️ Status\n'));
  console.log(`  System: ${s.status}`);
  console.log(`  Uptime: ${Math.floor(s.uptime / 60)}m`);
});

program.parse();
