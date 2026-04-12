import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { createTask } from '../lib/task.js';
import {
  getAssetsDir,
  cacheExternalResources,
  rewriteHtmlWithCachedExternalResources,
  scanAllTasks,
} from '../lib/resource-cache.js';
import { resetDb, getDb } from '../lib/db.js';

let tmpDir;
let originalFetch;

function makeResponse(body, contentType) {
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
    },
  });
}

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'agent-task-resource-cache-'));
  process.env.AGENT_TASK_HOME = tmpDir;
  process.env.OPENCLAW_HOME = tmpDir;
  resetDb();
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  resetDb();
  rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.AGENT_TASK_HOME;
  delete process.env.OPENCLAW_HOME;
});

describe('resource cache localization', () => {
  it('caches html external resources with MIME-aware filenames and rewrites nested CSS assets', async () => {
    globalThis.fetch = vi.fn(async (url) => {
      switch (url) {
        case 'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap':
          return makeResponse(
            "@font-face { src: url('https://fonts.gstatic.com/s/inter/v1/font.woff2') format('woff2'); } body { font-family: 'Inter'; }",
            'text/css; charset=utf-8',
          );
        case 'https://fonts.gstatic.com/s/inter/v1/font.woff2':
          return makeResponse(Buffer.from('fake-font'), 'font/woff2');
        case 'https://cdn.tailwindcss.com':
          return makeResponse('window.tailwind = { version: "4" };', 'application/javascript');
        case 'https://example.com/hero':
          return makeResponse(Buffer.from('png-bytes'), 'image/png');
        default:
          throw new Error(`Unexpected fetch: ${url}`);
      }
    });

    const task = createTask({ title: 'cache resource report' });
    writeFileSync(
      join(task.workspace_path, 'report.html'),
      [
        '<!doctype html>',
        '<html><head>',
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap">',
        '<script src="https://cdn.tailwindcss.com"></script>',
        '</head><body>',
        '<img src="https://example.com/hero" alt="hero">',
        '</body></html>',
      ].join(''),
    );

    const cached = await cacheExternalResources(task.workspace_path);
    const reportHtml = readFileSync(join(task.workspace_path, 'report.html'), 'utf-8');
    const servedHtml = rewriteHtmlWithCachedExternalResources(reportHtml);
    const assetsDir = getAssetsDir();
    const assets = readdirSync(assetsDir);

    expect(cached).toHaveLength(3);
    expect(reportHtml).toContain('fonts.googleapis.com');
    expect(reportHtml).toContain('cdn.tailwindcss.com');
    expect(reportHtml).toContain('https://example.com/hero');
    expect(reportHtml).not.toContain('/api/assets/');
    expect(servedHtml).not.toContain('fonts.googleapis.com');
    expect(servedHtml).not.toContain('cdn.tailwindcss.com');
    expect(servedHtml).not.toContain('https://example.com/hero');
    expect(servedHtml.match(/\/api\/assets\//g)?.length).toBe(3);

    expect(assets.some((name) => name.endsWith('.css'))).toBe(true);
    expect(assets.some((name) => name.endsWith('.js'))).toBe(true);
    expect(assets.some((name) => name.endsWith('.png'))).toBe(true);
    expect(assets.some((name) => name.endsWith('.woff2'))).toBe(true);
    expect(existsSync(join(assetsDir, 'manifest.json'))).toBe(true);

    const cssName = assets.find((name) => name.endsWith('.css'));
    const cssContent = readFileSync(join(assetsDir, cssName), 'utf-8');
    expect(cssContent).toContain('/api/assets/');
    expect(cssContent).not.toContain('fonts.gstatic.com');
  });

  it('scans and repairs tasks whose workspace_path still points to an old absolute root', async () => {
    globalThis.fetch = vi.fn(async (url) => {
      if (url === 'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap') {
        return makeResponse('body { font-family: Inter; }', 'text/css; charset=utf-8');
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const task = createTask({ title: 'repair stale workspace path' });
    writeFileSync(
      join(task.workspace_path, 'report.html'),
      '<!doctype html><html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap"></head><body></body></html>',
    );

    const stalePath = task.workspace_path.replace(tmpDir, '/root/.openclaw/agent-task');
    const db = getDb();
    db.prepare('UPDATE tasks SET workspace_path = ? WHERE id = ?').run(stalePath, task.id);

    const result = await scanAllTasks();
    const storedPath = db.prepare('SELECT workspace_path FROM tasks WHERE id = ?').get(task.id).workspace_path;
    const reportHtml = readFileSync(join(task.workspace_path, 'report.html'), 'utf-8');
    const servedHtml = rewriteHtmlWithCachedExternalResources(reportHtml);

    expect(result.scanned).toBe(1);
    expect(result.cached).toBe(1);
    expect(result.errors).toBe(0);
    expect(storedPath).toBe(task.workspace_path);
    expect(reportHtml).toContain('fonts.googleapis.com');
    expect(servedHtml).toContain('/api/assets/');
  });
});
