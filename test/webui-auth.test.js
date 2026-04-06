import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { resetDb } from '../lib/db.js';
import { createSessionCookie } from '../lib/webui/auth.js';
import { startWebUiServer } from '../lib/webui/server.js';
import { ensureToken } from '../lib/webui/token-store.js';

let tmpDir;
let server;
let baseUrl;
let sessionCookie;

async function startTestServer() {
  server = startWebUiServer({ host: '127.0.0.1', port: 0 });
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
  sessionCookie = createSessionCookie(ensureToken());
}

async function stopTestServer() {
  if (!server) return;
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
  server = null;
}

describe('webui auth and spa access', () => {
  beforeAll(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'agent-task-webui-auth-'));
    process.env.AGENT_TASK_HOME = tmpDir;
    resetDb();
    await startTestServer();
  });

  afterAll(async () => {
    await stopTestServer();
    resetDb();
    rmSync(tmpDir, { recursive: true, force: true });
    delete process.env.AGENT_TASK_HOME;
  });

  it('rejects unauthenticated api requests', async () => {
    const res = await fetch(`${baseUrl}/api/tasks`);
    const text = await res.text();

    expect(res.status).toBe(401);
    expect(text).toContain('Unauthorized');
  });

  it('serves spa deep links only after authentication', async () => {
    const landing = await fetch(`${baseUrl}/`);
    const landingHtml = await landing.text();
    expect(landing.status).toBe(200);
    expect(landingHtml).toContain('Task Control Plane for AI Agents');

    const unauthenticated = await fetch(`${baseUrl}/task/demo`);
    expect(unauthenticated.status).toBe(401);

    const authenticated = await fetch(`${baseUrl}/task/demo`, {
      headers: { Cookie: sessionCookie },
    });
    const html = await authenticated.text();

    expect(authenticated.status).toBe(200);
    expect(authenticated.headers.get('content-type')).toContain('text/html');
    expect(html).toContain('<div id="root"></div>');
  });

  it('sanitizes auth redirect targets to stay on-site', async () => {
    const token = ensureToken();

    const external = await fetch(`${baseUrl}/auth?token=${token}&next=%2F%2Fevil.example%2Fpwn`, {
      redirect: 'manual',
    });
    expect(external.status).toBe(302);
    expect(external.headers.get('location')).toBe('/');

    const relative = await fetch(`${baseUrl}/auth?token=${token}&next=%2Ftasks%2Fdemo`, {
      redirect: 'manual',
    });
    expect(relative.status).toBe(302);
    expect(relative.headers.get('location')).toBe('/tasks/demo');
  });
});
