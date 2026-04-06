import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { initDb } from '../db.js';
import { getTask, listTasks } from '../task.js';
import { error, info, success } from '../format.js';
import { ensureToken, getToken, resetToken } from '../webui/token-store.js';
import { createSessionCookie } from '../webui/auth.js';
import { clearPidInfo, isProcessAlive, readPidInfo, writePidInfo } from '../webui/pid-store.js';
import { getBindConfig, getPublicUrl, readWebuiConfig, setWebuiConfig } from '../webui/config-store.js';
import { getSystemLogPath, readSystemLogs } from '../webui/system-log.js';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 3333;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const serverBinPath = join(__dirname, '../../bin/agent-task-webui-server.js');

function makeBaseUrl(host, port) {
  return `http://${host}:${port}`;
}

function resolveDisplayBaseUrl(host, port) {
  return getPublicUrl() || makeBaseUrl(host, port);
}

function makeLoginUrl(baseUrl, token, next = '/') {
  const p = next && String(next).startsWith('/') ? String(next) : '/';
  return `${baseUrl}/auth?token=${encodeURIComponent(token)}&next=${encodeURIComponent(p)}`;
}

function makeOptionalLoginUrl(baseUrl, token, next, enabled) {
  return enabled ? makeLoginUrl(baseUrl, token, next) : null;
}

function parsePort(port) {
  const n = Number(port);
  if (!Number.isInteger(n) || n <= 0 || n > 65535) {
    throw new Error(`Invalid port: ${port}`);
  }
  return n;
}

function ensureStoppedStaleProcess() {
  const pidInfo = readPidInfo();
  if (!pidInfo) return;
  if (!isProcessAlive(pidInfo.pid)) {
    clearPidInfo(pidInfo.pid);
  }
}

function uniqueTargets(targets = []) {
  const seen = new Set();
  return targets.filter((target) => {
    if (!target?.host || !target?.port) return false;
    const key = `${target.host}:${target.port}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getRuntimeCandidates({ pidInfo, opts = {} } = {}) {
  const bindCfg = getBindConfig(DEFAULT_HOST, DEFAULT_PORT);
  return uniqueTargets([
    pidInfo ? { host: pidInfo.host, port: pidInfo.port } : null,
    opts.host || opts.port ? {
      host: opts.host || bindCfg.host,
      port: parsePort(opts.port || bindCfg.port),
    } : null,
    process.env.AGENT_TASK_WEBUI_HOST || process.env.AGENT_TASK_WEBUI_PORT ? {
      host: process.env.AGENT_TASK_WEBUI_HOST || bindCfg.host,
      port: parsePort(process.env.AGENT_TASK_WEBUI_PORT || bindCfg.port),
    } : null,
    { host: bindCfg.host, port: bindCfg.port },
  ]);
}

function getRuntimeTarget(opts = {}) {
  const pidInfo = readPidInfo();
  const bindCfg = getBindConfig(DEFAULT_HOST, DEFAULT_PORT);
  const host = pidInfo?.host || opts.host || bindCfg.host || DEFAULT_HOST;
  const port = pidInfo?.port || parsePort(opts.port || bindCfg.port || DEFAULT_PORT);
  return { host, port };
}

function persistWebuiRuntimeConfig(opts = {}) {
  const next = {};
  let shouldPersist = false;

  if (opts.host !== undefined) {
    next.host = opts.host;
    shouldPersist = true;
  }
  if (opts.port !== undefined) {
    next.port = parsePort(opts.port);
    shouldPersist = true;
  }
  if (opts.url !== undefined) {
    next.publicUrl = opts.url;
    shouldPersist = true;
  }

  if (!shouldPersist) return null;
  return setWebuiConfig(next);
}

function printArtifactLinks(taskId, baseUrl, token, availability = {}) {
  console.log(`Auth:   ${makeLoginUrl(baseUrl, token, '/')}`);
  console.log(`Task:   ${makeLoginUrl(baseUrl, token, `/task/${taskId}`)}`);
  console.log(`Report: ${makeOptionalLoginUrl(baseUrl, token, `/task/${taskId}#report`, availability.reportMd)}`);
  console.log(`Files:  ${makeLoginUrl(baseUrl, token, `/task/${taskId}#files`)}`);
  console.log(`HTML:   ${makeOptionalLoginUrl(baseUrl, token, `/api/tasks/${taskId}/open-report`, availability.reportHtml)}`);
  console.log(`MP3:    ${makeOptionalLoginUrl(baseUrl, token, `/api/tasks/${taskId}/file?path=report.mp3`, availability.reportMp3)}`);
  console.log(`WAV:    ${makeOptionalLoginUrl(baseUrl, token, `/api/tasks/${taskId}/file?path=report.wav`, availability.reportWav)}`);
}

function printLoginWarning() {
  console.log('Warning: 请不要在公共电脑登录。当前登录密钥暂未设置有效期，如有需要可通过 `agent-task webui token reset` 重置密钥。');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForProcessExit(pid, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isProcessAlive(pid)) {
      return true;
    }
    await sleep(100);
  }
  return !isProcessAlive(pid);
}

function normalizeRuntimeInfo(info, fallbackHost, fallbackPort) {
  const pid = Number(info?.pid);
  const host = String(info?.host || fallbackHost || '').trim();
  const port = Number(info?.port ?? fallbackPort);
  const startedAt = String(info?.startedAt || '').trim();

  if (!Number.isInteger(pid) || pid <= 0) return null;
  if (!host) return null;
  if (!Number.isInteger(port) || port <= 0 || port > 65535) return null;

  return {
    pid,
    host,
    port,
    startedAt: startedAt || new Date().toISOString(),
    url: `http://${host}:${port}`,
  };
}

async function fetchRuntimeInfo(host, port) {
  const token = getToken();
  if (!token || !host || !port) {
    return null;
  }

  try {
    const res = await fetch(`http://${host}:${port}/api/internal/runtime`, {
      headers: {
        Cookie: createSessionCookie(token),
      },
    });
    if (!res.ok) {
      return null;
    }
    return normalizeRuntimeInfo(await res.json(), host, port);
  } catch {
    return null;
  }
}

async function detectRunningService({ host, port, restorePidInfo = false }) {
  const runtime = await fetchRuntimeInfo(host, port);
  if (!runtime || !isProcessAlive(runtime.pid)) {
    return null;
  }
  if (restorePidInfo) {
    writePidInfo(runtime);
  }
  return runtime;
}

async function resolveHealthyRuntime(targets, { restorePidInfo = false } = {}) {
  return detectRunningServiceAcross(targets, { restorePidInfo });
}

async function terminateManagedProcess(pid, signal = 'SIGTERM') {
  if (!isProcessAlive(pid)) {
    return true;
  }

  process.kill(Number(pid), signal);

  if (signal === 'SIGTERM') {
    const stopped = await waitForProcessExit(pid);
    if (stopped) {
      return true;
    }
    process.kill(Number(pid), 'SIGKILL');
  }

  return waitForProcessExit(pid, 2000);
}

async function detectRunningServiceAcross(targets, { restorePidInfo = false } = {}) {
  for (const target of targets) {
    const runtime = await detectRunningService({
      host: target.host,
      port: target.port,
      restorePidInfo,
    });
    if (runtime) return runtime;
  }
  return null;
}

function findManagedWebuiProcess() {
  try {
    const output = execFileSync('ps', ['-eo', 'pid=,args='], { encoding: 'utf-8' });
    const lines = output.split('\n').map((line) => line.trim()).filter(Boolean);
    for (const line of lines) {
      if (!line.includes('agent-task-webui-server.js')) continue;
      const match = line.match(/^(\d+)\s+(.+)$/);
      if (!match) continue;
      const pid = Number(match[1]);
      if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid) continue;
      return { pid, command: match[2] };
    }
  } catch {
    // Ignore process table lookup failures.
  }
  return null;
}

function detectManagedProcessFallback(targets, { restorePidInfo = false, pidInfo = null } = {}) {
  const processInfo = findManagedWebuiProcess();
  if (!processInfo || !isProcessAlive(processInfo.pid)) {
    return null;
  }

  const target = targets.find(Boolean) || { host: DEFAULT_HOST, port: DEFAULT_PORT };
  const runtime = {
    pid: processInfo.pid,
    host: target.host,
    port: target.port,
    startedAt: pidInfo?.startedAt || 'unknown',
    url: `http://${target.host}:${target.port}`,
  };

  if (restorePidInfo) {
    writePidInfo(runtime);
  }

  return runtime;
}

async function waitForRuntimeInfo({ host, port, expectedPid, timeoutMs = 5000 }) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const runtime = await detectRunningService({ host, port, restorePidInfo: true });
    if (runtime && (!expectedPid || Number(runtime.pid) === Number(expectedPid))) {
      return runtime;
    }
    await sleep(100);
  }
  return null;
}

export default function registerWebuiCommand(program) {
  const webui = program
    .command('webui')
    .description('Manage agent-task web UI service');

  async function startService({ host, port, resetToken: shouldResetToken }) {
    initDb();
    ensureStoppedStaleProcess();
    const current = readPidInfo();
    if (current && isProcessAlive(current.pid)) {
      const runtime = await detectRunningService({
        host: current.host,
        port: current.port,
        restorePidInfo: true,
      });
      if (runtime && Number(runtime.pid) === Number(current.pid)) {
        info(`WebUI is already running at http://${runtime.host}:${runtime.port} (pid ${runtime.pid})`);
        return;
      }
    }

    const running = await resolveHealthyRuntime(
      getRuntimeCandidates({ opts: { host, port } }),
      { restorePidInfo: true },
    );
    if (running) {
      info(`WebUI is already running at http://${running.host}:${running.port} (pid ${running.pid})`);
      return;
    }

    const token = shouldResetToken ? resetToken() : ensureToken();
    const child = spawn(process.execPath, [serverBinPath], {
      detached: true,
      stdio: 'ignore',
      env: {
        ...process.env,
        AGENT_TASK_WEBUI_HOST: host,
        AGENT_TASK_WEBUI_PORT: String(port),
      },
    });

    child.unref();

    const runtime = await waitForRuntimeInfo({ host, port, expectedPid: child.pid });
    if (!runtime) {
      throw new Error(`WebUI failed to start on http://${host}:${port}. Check port availability or server logs.`);
    }

    const displayBase = resolveDisplayBaseUrl(runtime.host, runtime.port);
    success(`WebUI started on http://${runtime.host}:${runtime.port} (pid ${runtime.pid})`);
    console.log();
    console.log(`Open: ${makeLoginUrl(displayBase, token, '/')}`);
    printLoginWarning();
  }

  async function stopService() {
    const pidInfo = readPidInfo();

    if (pidInfo && isProcessAlive(pidInfo.pid)) {
      await terminateManagedProcess(pidInfo.pid);
      clearPidInfo(pidInfo.pid);
      success(`Stopped WebUI (pid ${pidInfo.pid})`);
      return;
    }

    let runtime = await resolveHealthyRuntime(
      getRuntimeCandidates({ pidInfo }),
      { restorePidInfo: true },
    );
    if (!runtime) {
      runtime = detectManagedProcessFallback(
        getRuntimeCandidates({ pidInfo }),
        { restorePidInfo: true, pidInfo },
      );
    }

    if (runtime) {
      await terminateManagedProcess(runtime.pid);
      clearPidInfo(runtime.pid);
      success(`Stopped WebUI (pid ${runtime.pid})`);
      return;
    }

    if (pidInfo) {
      info('WebUI process not alive, cleaning stale pid file');
      clearPidInfo(pidInfo.pid);
    } else {
      info('WebUI is not running');
    }
  }

  webui
    .command('start')
    .description('Start web UI server')
    .option('--host <host>', 'Host to bind')
    .option('--port <port>', 'Port to bind')
    .option('--url <url>', 'Public domain, e.g. https://task.example.com')
    .option('--reset-token', 'Reset access token before start')
    .action(async (opts) => {
      try {
        persistWebuiRuntimeConfig(opts);
        const bindCfg = getBindConfig(DEFAULT_HOST, DEFAULT_PORT);
        const host = opts.host || bindCfg.host;
        const port = parsePort(opts.port || bindCfg.port);
        await startService({ host, port, resetToken: opts.resetToken });
      } catch (e) {
        error(e.message);
        process.exit(1);
      }
    });

  webui
    .command('dev')
    .description('Run web UI in dev mode with auto-reload')
    .option('--host <host>', 'Host to bind')
    .option('--port <port>', 'Port to bind')
    .option('--url <url>', 'Public domain, e.g. https://task.example.com')
    .option('--reset-token', 'Reset access token before start')
    .action((opts) => {
      try {
        initDb();
        persistWebuiRuntimeConfig(opts);
        ensureStoppedStaleProcess();
        const current = readPidInfo();
        if (current && isProcessAlive(current.pid)) {
          throw new Error(`WebUI is already running at http://${current.host}:${current.port}. Stop it first.`);
        }

        const bindCfg = getBindConfig(DEFAULT_HOST, DEFAULT_PORT);
        const host = opts.host || bindCfg.host;
        const port = parsePort(opts.port || bindCfg.port);
        const token = opts.resetToken ? resetToken() : ensureToken();
        const displayBase = resolveDisplayBaseUrl(host, port);

        info('Starting WebUI dev server with auto-reload...');
        console.log(`Open: ${makeLoginUrl(displayBase, token, '/')}`);
        printLoginWarning();
        console.log('Tip: static files update on browser refresh; backend code auto-restarts.');

        const child = spawn(process.execPath, ['--watch', serverBinPath], {
          stdio: 'inherit',
          env: {
            ...process.env,
            AGENT_TASK_WEBUI_HOST: host,
            AGENT_TASK_WEBUI_PORT: String(port),
          },
        });

        process.on('SIGINT', () => child.kill('SIGINT'));
        process.on('SIGTERM', () => child.kill('SIGTERM'));
        child.on('exit', (code) => process.exit(code ?? 0));
      } catch (e) {
        error(e.message);
        process.exit(1);
      }
    });

  webui
    .command('restart')
    .description('Restart web UI server')
    .option('--host <host>', 'Host to bind')
    .option('--port <port>', 'Port to bind')
    .option('--url <url>', 'Public domain, e.g. https://task.example.com')
    .option('--reset-token', 'Reset access token before restart')
    .action(async (opts) => {
      try {
        persistWebuiRuntimeConfig(opts);
        await stopService();
        const bindCfg = getBindConfig(DEFAULT_HOST, DEFAULT_PORT);
        const host = opts.host || bindCfg.host;
        const port = parsePort(opts.port || bindCfg.port);
        await startService({ host, port, resetToken: opts.resetToken });
      } catch (e) {
        error(e.message);
        process.exit(1);
      }
    });

  webui
    .command('stop')
    .description('Stop web UI server')
    .action(async () => {
      try {
        await stopService();
      } catch (e) {
        error(e.message);
        process.exit(1);
      }
    });

  webui
    .command('status')
    .description('Show web UI status')
    .action(async () => {
      let pidInfo = readPidInfo();
      let runtime = null;

      if (pidInfo && isProcessAlive(pidInfo.pid)) {
        runtime = await detectRunningService({
          host: pidInfo.host,
          port: pidInfo.port,
          restorePidInfo: true,
        });
      } else if (pidInfo && !isProcessAlive(pidInfo.pid)) {
        clearPidInfo(pidInfo.pid);
      }

      if (!runtime) {
        if (pidInfo && !isProcessAlive(pidInfo.pid)) {
          clearPidInfo(pidInfo.pid);
        }
        runtime = await resolveHealthyRuntime(
          getRuntimeCandidates({ pidInfo }),
          { restorePidInfo: true },
        );
        if (!runtime) {
          runtime = detectManagedProcessFallback(
            getRuntimeCandidates({ pidInfo }),
            { restorePidInfo: true, pidInfo },
          );
        }
        pidInfo = runtime;
      }

      if (!runtime) {
        info('WebUI status: stopped');
        return;
      }

      const displayBase = resolveDisplayBaseUrl(runtime.host, runtime.port);
      const intervalSeconds = Number(process.env.AGENT_TASK_DISPATCH_INTERVAL_SECONDS || 30);
      const maxConcurrent = Number(process.env.AGENT_TASK_MAX_CONCURRENT || 2);
      const runningTasks = listTasks({ status: 'in_progress' })
        .filter((task) => task.dispatch_status === 'running' || task.dispatch_status === 'repairing')
        .length;
      success('WebUI status: running');
      console.log(`  PID:        ${runtime.pid}`);
      console.log(`  Bind Host:  ${runtime.host}`);
      console.log(`  Bind Port:  ${runtime.port}`);
      console.log(`  Bind URL:   http://${runtime.host}:${runtime.port}`);
      console.log(`  Public URL: ${displayBase}`);
      console.log(`  Scheduler:  enabled`);
      console.log(`  Interval:   ${intervalSeconds}s`);
      console.log(`  Max Concur: ${maxConcurrent}`);
      console.log(`  Running:    ${runningTasks}`);
      console.log(`  Since:      ${runtime.startedAt}`);
    });

  webui
    .command('logs')
    .description('Show recent system logs')
    .option('--source <source>', 'Filter by source, e.g. scheduler')
    .option('--limit <limit>', 'Maximum number of log entries', '50')
    .action((opts) => {
      const logs = readSystemLogs(opts.limit);
      const items = opts.source
        ? logs.items.filter((item) => item.source === opts.source)
        : logs.items;

      info(`System Log: ${getSystemLogPath()}`);
      if (!items.length) {
        console.log('(no log entries)');
        return;
      }

      for (const item of items) {
        const meta = item.meta ? ` ${JSON.stringify(item.meta)}` : '';
        console.log(`[${item.ts}] ${item.level} ${item.source}: ${item.message}${meta}`);
      }
    });

  const token = webui
    .command('token')
    .description('Manage web UI token');

  token
    .command('show')
    .description('Show current token and login URL')
    .option('--host <host>', 'Host for URL output')
    .option('--port <port>', 'Port for URL output')
    .action((opts) => {
      const value = getToken() || ensureToken();
      const { host, port } = getRuntimeTarget(opts);
      const baseUrl = resolveDisplayBaseUrl(host, port);

      info(`Token: ${value}`);
      console.log(`Open: ${makeLoginUrl(baseUrl, value, '/')}`);
      printLoginWarning();
    });

  token
    .command('reset')
    .description('Reset token and show new login URL')
    .option('--host <host>', 'Host for URL output')
    .option('--port <port>', 'Port for URL output')
    .action((opts) => {
      const value = resetToken();
      const { host, port } = getRuntimeTarget(opts);
      const baseUrl = resolveDisplayBaseUrl(host, port);

      success('WebUI token reset');
      console.log(`Token: ${value}`);
      console.log(`Open: ${makeLoginUrl(baseUrl, value, '/')}`);
      printLoginWarning();
    });

  const config = webui
    .command('config')
    .description('Manage web UI config');

  config
    .command('show')
    .description('Show current web UI config')
    .action(() => {
      const cfg = readWebuiConfig();
      const bindCfg = getBindConfig(DEFAULT_HOST, DEFAULT_PORT);
      const value = getPublicUrl();
      info(`Bind Host: ${cfg.host || `(default: ${bindCfg.host})`}`);
      info(`Bind Port: ${cfg.port || `(default: ${bindCfg.port})`}`);
      info(`Bind URL: http://${bindCfg.host}:${bindCfg.port}`);
      info(`Public URL: ${value || '(not set; links use bind URL)'}`);
    });

  config
    .command('set')
    .description('Set host/port/public URL')
    .option('--host <host>', 'Bind host, e.g. 0.0.0.0')
    .option('--port <port>', 'Bind port, e.g. 3333')
    .option('--url <url>', 'Public domain, e.g. https://task.example.com')
    .action((opts) => {
      if (!opts.host && !opts.port && !opts.url) {
        throw new Error('At least one of --host, --port, --url is required');
      }
      const next = setWebuiConfig({
        host: opts.host,
        port: opts.port,
        publicUrl: opts.url,
      });
      success('WebUI config updated');
      if (opts.host) console.log(`Host: ${next.host}`);
      if (opts.port) console.log(`Port: ${next.port}`);
      if (opts.url) console.log(`Public URL: ${next.publicUrl}`);
    });

  config
    .command('clear')
    .description('Clear stored host/port/public URL config')
    .option('--host', 'Clear stored host')
    .option('--port', 'Clear stored port')
    .option('--url', 'Clear stored public URL')
    .option('--all', 'Clear all stored config')
    .action((opts) => {
      const clearHost = opts.host || opts.all;
      const clearPort = opts.port || opts.all;
      const clearUrl = opts.url || opts.all;

      if (!clearHost && !clearPort && !clearUrl) {
        throw new Error('Specify --host / --port / --url / --all');
      }
      setWebuiConfig({
        host: clearHost ? null : undefined,
        port: clearPort ? null : undefined,
        publicUrl: clearUrl ? null : undefined,
      });
      success('WebUI config cleared');
    });

  webui
    .command('links <id>')
    .description('Print shareable links for task deliverables')
    .option('--host <host>', 'Host fallback when no public URL')
    .option('--port <port>', 'Port fallback when no public URL')
    .action((id, opts) => {
      const task = getTask(id);
      if (!task) {
        error(`Task not found: ${id}`);
        process.exit(1);
      }

      const tokenValue = getToken() || ensureToken();
      const { host, port } = getRuntimeTarget(opts);
      const baseUrl = resolveDisplayBaseUrl(host, port);
      const availability = {
        reportMd: false,
        reportHtml: false,
        reportMp3: false,
        reportWav: false,
      };

      if (task.workspace_path) {
        availability.reportHtml = existsSync(join(task.workspace_path, 'report.html'));
        availability.reportMd = existsSync(join(task.workspace_path, 'report.md'));
        availability.reportMp3 = existsSync(join(task.workspace_path, 'report.mp3'));
        availability.reportWav = existsSync(join(task.workspace_path, 'report.wav'));
      }

      info(`Links for task ${id}`);
      printArtifactLinks(id, baseUrl, tokenValue, availability);
      printLoginWarning();

      if (task.workspace_path) {
        console.log(`report.html: ${availability.reportHtml ? 'yes' : 'no'}`);
        console.log(`report.md:   ${availability.reportMd ? 'yes' : 'no'}`);
        console.log(`report.mp3:  ${availability.reportMp3 ? 'yes' : 'no'}`);
        console.log(`report.wav:  ${availability.reportWav ? 'yes' : 'no'}`);
      } else {
        console.log('workspace:   not created');
      }
    });
}
