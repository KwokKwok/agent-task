#!/usr/bin/env node

import { createRequire } from 'node:module';
import { Command } from 'commander';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { version } = require(resolve(__dirname, '../package.json'));

const program = new Command();
program
  .name('agent-task')
  .description('Agent Task CLI')
  .version(version);

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
