#!/usr/bin/env node

import { clearPidInfo } from '../lib/webui/pid-store.js';
import { startWebUiServer } from '../lib/webui/server.js';

const host = process.env.AGENT_TASK_WEBUI_HOST || '127.0.0.1';
const port = Number(process.env.AGENT_TASK_WEBUI_PORT || '3333');

startWebUiServer({ host, port });

process.on('exit', () => {
  clearPidInfo(process.pid);
});
