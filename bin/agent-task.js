#!/usr/bin/env node

import { Command } from 'commander';

const program = new Command();
program
  .name('agent-task')
  .description('Agent Task CLI')
  .version('0.2.0');

// 动态加载所有命令
const commands = [
  'init', 'create', 'status', 'workspace',
  'list', 'show', 'archive', 'webui', 'feedback', 'type',
];

for (const cmd of commands) {
  const mod = await import(`../lib/commands/${cmd}.js`);
  mod.default(program);
}

program.parse();
