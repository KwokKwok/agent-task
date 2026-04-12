import http from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { handleApiRequest } from './api.js';
import { clearSessionCookie, createSessionCookie, isTokenValid, validateSession } from './auth.js';
import { writePidInfo } from './pid-store.js';
import { createScheduler } from './scheduler.js';
import { ensureToken } from './token-store.js';
import { writeSystemLog } from './system-log.js';

function getContentType(filePath) {
  const ext = extname(filePath).toLowerCase();
  switch (ext) {
    case '.css': return 'text/css; charset=utf-8';
    case '.js': return 'application/javascript; charset=utf-8';
    case '.html': return 'text/html; charset=utf-8';
    case '.json': return 'application/json; charset=utf-8';
    case '.svg': return 'image/svg+xml; charset=utf-8';
    case '.woff': return 'font/woff';
    case '.woff2': return 'font/woff2';
    case '.ttf': return 'font/ttf';
    case '.otf': return 'font/otf';
    case '.eot': return 'application/vnd.ms-fontobject';
    default: return 'text/plain; charset=utf-8';
  }
}

function unauthorized(res) {
  res.writeHead(401, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Unauthorized. Use the CLI login URL to authenticate.');
}

function notFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not Found');
}

function noContent(res) {
  res.writeHead(204);
  res.end();
}

function serveLandingFallback(res) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Agent Task | OpenClaw Worklog</title>
</head>
<body>
  <main style="padding:40px;font-family:IBM Plex Sans,system-ui,sans-serif;">
    <h1>Agent Task | OpenClaw Worklog</h1>
    <p>公开入口可用。执行 <code>agent-task webui token show</code> 获取登录链接。</p>
  </main>
</body>
</html>`);
}

function serveStatic(res, staticDir, pathname) {
  const normalized = pathname === '/' ? '/index.html' : pathname;
  if (normalized.includes('..')) {
    notFound(res);
    return true;
  }

  const target = join(staticDir, normalized);
  if (!existsSync(target)) return false;

  const stats = statSync(target);
  if (!stats.isFile()) return false;

  res.writeHead(200, { 'Content-Type': getContentType(target) });
  res.end(readFileSync(target));
  return true;
}

function sanitizeNextPath(input) {
  const raw = String(input || '/');
  if (!raw.startsWith('/')) return '/';
  if (raw.startsWith('//')) return '/';
  return raw;
}

async function parseRequestBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8');
      if (!raw) { resolve({ json: null, text: '' }); return; }
      try { resolve({ json: JSON.parse(raw), text: raw }); }
      catch { resolve({ json: null, text: raw }); }
    });
    req.on('error', () => resolve({ json: null, text: '' }));
  });
}

export function startWebUiServer({ host = '127.0.0.1', port = 3333, scheduler: injectedScheduler } = {}) {
  const token = ensureToken();
  const startedAt = new Date().toISOString();
  let boundPort = port;
  const scheduler = injectedScheduler || createScheduler({
    intervalMs: Number(process.env.AGENT_TASK_DISPATCH_INTERVAL_SECONDS || 30) * 1000,
    maxConcurrent: Number(process.env.AGENT_TASK_MAX_CONCURRENT || 2),
  });
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const staticDir = join(__dirname, 'static');

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || `${host}:${port}`}`);
    const pathname = url.pathname;
    const authenticated = validateSession(req, token);

    if (pathname === '/auth' && req.method === 'GET') {
      const inputToken = url.searchParams.get('token');
      if (isTokenValid(inputToken, token)) {
        const next = sanitizeNextPath(url.searchParams.get('next'));
        res.writeHead(302, {
          'Set-Cookie': createSessionCookie(token),
          Location: next,
        });
        res.end();
      } else {
        res.writeHead(401, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Invalid token');
      }
      return;
    }

    if (pathname === '/logout' && req.method === 'POST') {
      res.writeHead(204, {
        'Set-Cookie': clearSessionCookie(),
      });
      res.end();
      return;
    }

    if (pathname === '/favicon.ico' && req.method === 'GET') {
      noContent(res);
      return;
    }

    if (pathname.startsWith('/api/')) {
      const allowTokenizedAsset = req.method === 'GET'
        && /^\/api\/tasks\/[a-z0-9-]+\/asset-token\/[^/]+\/.+$/.test(pathname);
      const allowCachedAsset = req.method === 'GET'
        && /^\/api\/assets\/[a-f0-9]+\.[a-zA-Z0-9]+$/.test(pathname);

      if (!authenticated && !allowTokenizedAsset && !allowCachedAsset) {
        unauthorized(res);
        return;
      }
      const parsed = await parseRequestBody(req);
      const handled = await handleApiRequest(req, res, pathname, url.searchParams, parsed, {
        scheduler,
        runtimeInfo: {
          pid: process.pid,
          host,
          port: boundPort,
          startedAt,
        },
        authToken: token,
      });
      if (!handled) {
        notFound(res);
      }
      return;
    }

    if (pathname.startsWith('/static/')) {
      const handled = serveStatic(res, staticDir, pathname.replace('/static', ''));
      if (!handled) notFound(res);
      return;
    }

    if (pathname.startsWith('/fonts/')) {
      const handled = serveStatic(res, staticDir, pathname);
      if (!handled) notFound(res);
      return;
    }

    if ((pathname === '/' || pathname === '/landing' || pathname === '/landing.html') && req.method === 'GET' && !authenticated) {
      const handled = serveStatic(res, staticDir, '/landing.html');
      if (!handled) serveLandingFallback(res);
      return;
    }

    // SPA fallback: any authenticated non-API GET route returns index.html,
    // so refreshing deep links (e.g. /task/:id) won't 404 behind reverse proxies.
    if (req.method === 'GET') {
      if (!authenticated) {
        unauthorized(res);
        return;
      }
      const handled = serveStatic(res, staticDir, '/index.html');
      if (!handled) notFound(res);
      return;
    }

    notFound(res);
  });

  server.listen(port, host, () => {
    scheduler.start();
    const address = server.address();
    const actualPort = typeof address === 'object' && address ? address.port : port;
    boundPort = actualPort;
    writePidInfo({
      pid: process.pid,
      host,
      port: actualPort,
      startedAt,
      url: `http://${host}:${actualPort}`,
    });
    writeSystemLog('info', 'webui', 'WebUI server started', {
      host,
      port: actualPort,
      pid: process.pid,
    });

  });

  server.on('error', (err) => {
    console.error(`[webui] server error: ${err.message}`);
    writeSystemLog('error', 'webui', 'WebUI server error', err);
    process.exit(1);
  });

  server.on('close', () => {
    scheduler.stop();
  });

  const shutdown = () => {
    scheduler.stop();
    server.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return server;
}
