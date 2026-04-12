import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const { sendAgentMessageMock, restartGatewayMock } = vi.hoisted(() => ({
  sendAgentMessageMock: vi.fn(),
  restartGatewayMock: vi.fn(),
}));
const { isS3EnabledMock, getPresignedUrlMock, getPublicObjectUrlMock, verifyS3ConnectionMock, ensureBucketCorsMock, ensureBucketStructureMock, ensureFileSyncedToS3Mock } = vi.hoisted(() => ({
  isS3EnabledMock: vi.fn(() => false),
  getPresignedUrlMock: vi.fn(),
  getPublicObjectUrlMock: vi.fn(),
  verifyS3ConnectionMock: vi.fn(),
  ensureBucketCorsMock: vi.fn(),
  ensureBucketStructureMock: vi.fn(),
  ensureFileSyncedToS3Mock: vi.fn(),
}));

vi.mock('../lib/openclaw.js', async () => {
  const actual = await vi.importActual('../lib/openclaw.js');
  return {
    ...actual,
    sendAgentMessage: sendAgentMessageMock,
    restartGateway: restartGatewayMock,
  };
});

vi.mock('../lib/webui/s3-client.js', async () => {
  const actual = await vi.importActual('../lib/webui/s3-client.js');
  return {
    ...actual,
    isS3Enabled: isS3EnabledMock,
    getPresignedUrl: getPresignedUrlMock,
    getPublicObjectUrl: getPublicObjectUrlMock,
    verifyS3Connection: verifyS3ConnectionMock,
    ensureBucketCors: ensureBucketCorsMock,
    ensureBucketStructure: ensureBucketStructureMock,
  };
});

vi.mock('../lib/webui/s3-sync.js', async () => {
  const actual = await vi.importActual('../lib/webui/s3-sync.js');
  return {
    ...actual,
    ensureFileSyncedToS3: ensureFileSyncedToS3Mock,
  };
});

import { getDb, resetDb } from '../lib/db.js';
import { buildChatAgentPrompt, buildExecutionReferencePrompt } from '../lib/prompt-builders.js';
import { getAssetsDir } from '../lib/resource-cache.js';
import { createTask, setStatus } from '../lib/task.js';
import { createTaskRun } from '../lib/task-run.js';
import { readWebuiConfig, setWebuiConfig } from '../lib/webui/config-store.js';
import { createSessionCookie } from '../lib/webui/auth.js';
import { startWebUiServer } from '../lib/webui/server.js';
import { writeSystemLog } from '../lib/webui/system-log.js';
import { ensureToken } from '../lib/webui/token-store.js';

const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'));

let tmpDir;
let server;
let baseUrl;
let sessionCookie;
const schedulerMock = {
  start: vi.fn(),
  stop: vi.fn(),
  runCycle: vi.fn().mockResolvedValue({ ok: true }),
};

async function startTestServer () {
  server = startWebUiServer({ host: '127.0.0.1', port: 0, scheduler: schedulerMock });
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
  sessionCookie = createSessionCookie(ensureToken());
}

async function stopTestServer () {
  if (!server) return;
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
  server = null;
}

async function fetchJson (pathname, init = {}) {
  const res = await fetch(`${baseUrl}${pathname}`, {
    ...init,
    headers: {
      Cookie: sessionCookie,
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  return { res, data };
}

describe('webui api boundaries', () => {
  beforeAll(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'agent-task-webui-api-'));
    process.env.AGENT_TASK_HOME = tmpDir;
    process.env.OPENCLAW_HOME = tmpDir;
    resetDb();
    await startTestServer();
  });

  beforeEach(() => {
    schedulerMock.start.mockClear();
    schedulerMock.stop.mockClear();
    schedulerMock.runCycle.mockClear();
    schedulerMock.runCycle.mockResolvedValue({ ok: true });
    sendAgentMessageMock.mockReset();
    restartGatewayMock.mockReset();
    sendAgentMessageMock.mockResolvedValue({
      ok: true,
      code: 0,
      signal: null,
      stdout: '写入完成',
      stderr: '',
    });
    restartGatewayMock.mockResolvedValue({
      ok: true,
      code: 0,
      signal: null,
      stdout: 'gateway restarted',
      stderr: '',
    });
    isS3EnabledMock.mockReset();
    isS3EnabledMock.mockReturnValue(false);
    getPresignedUrlMock.mockReset();
    getPresignedUrlMock.mockResolvedValue(null);
    getPublicObjectUrlMock.mockReset();
    getPublicObjectUrlMock.mockResolvedValue(null);
    verifyS3ConnectionMock.mockReset();
    verifyS3ConnectionMock.mockResolvedValue({ ok: true });
    ensureBucketCorsMock.mockReset();
    ensureBucketCorsMock.mockResolvedValue(undefined);
    ensureBucketStructureMock.mockReset();
    ensureBucketStructureMock.mockResolvedValue(undefined);
    ensureFileSyncedToS3Mock.mockReset();
    ensureFileSyncedToS3Mock.mockResolvedValue(false);
    setWebuiConfig({ resourceCache: { enabled: true } });
  });

  afterAll(async () => {
    await stopTestServer();
    resetDb();
    rmSync(tmpDir, { recursive: true, force: true });
    delete process.env.AGENT_TASK_HOME;
    delete process.env.OPENCLAW_HOME;
  });

  it('lists records for authenticated requests', async () => {
    const task = createTask({ title: 'API smoke task', status: 'todo', priority: 'high' });
    const { res, data } = await fetchJson('/api/tasks');

    expect(res.status).toBe(200);
    expect(data.items.some((item) => item.id === task.id && item.title === 'API smoke task')).toBe(true);
  });

  it('defaults task listing to created_at desc instead of updated_at desc', async () => {
    const older = createTask({ title: '较早任务' });
    await new Promise((resolve) => setTimeout(resolve, 20));
    const newer = createTask({ title: '较新任务' });

    setStatus(older.id, 'in_progress');

    const { res, data } = await fetchJson('/api/tasks');

    expect(res.status).toBe(200);
    expect(data.sortBy).toBe('created_at');
    expect(data.order).toBe('desc');
    expect(data.items.findIndex((item) => item.id === newer.id)).toBeLessThan(
      data.items.findIndex((item) => item.id === older.id),
    );
  });

  it('respects created_at ordering even when updated_at is newer on an older task', async () => {
    const db = getDb();
    db.prepare(`
      INSERT INTO tasks (
        id,
        title,
        description,
        type_id,
        status,
        priority,
        workspace_path,
        timeout_seconds,
        dispatch_status,
        repair_count,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'oldtask1',
      '旧任务',
      null,
      null,
      'todo',
      'medium',
      '/tmp/oldtask1',
      1800,
      'idle',
      0,
      '2026-04-07T00:00:00.000Z',
      '2026-04-07T23:59:59.000Z',
    );
    db.prepare(`
      INSERT INTO tasks (
        id,
        title,
        description,
        type_id,
        status,
        priority,
        workspace_path,
        timeout_seconds,
        dispatch_status,
        repair_count,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'newtask1',
      '新任务',
      null,
      null,
      'todo',
      'medium',
      '/tmp/newtask1',
      1800,
      'idle',
      0,
      '2026-04-07T12:00:00.000Z',
      '2026-04-07T12:00:01.000Z',
    );

    const { data } = await fetchJson('/api/tasks');

    expect(data.items.findIndex((item) => item.id === 'newtask1')).toBeLessThan(
      data.items.findIndex((item) => item.id === 'oldtask1'),
    );
  });

  it('updates record status through the API', async () => {
    const task = createTask({ title: '状态更新' });
    const { res, data } = await fetchJson(`/api/tasks/${task.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress' }),
    });

    expect(res.status).toBe(200);
    expect(data.status).toBe('in_progress');
  });

  it('serves feedback summary and records human reject feedback', async () => {
    const task = createTask({ title: '反馈 API' });
    setStatus(task.id, 'done');

    const rejectRes = await fetchJson(`/api/tasks/${task.id}/feedback/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '请补充方案对比。' }),
    });
    expect(rejectRes.res.status).toBe(200);

    const feedbackRes = await fetchJson(`/api/tasks/${task.id}/feedback`);
    expect(feedbackRes.res.status).toBe(200);
    expect(feedbackRes.data.content).toContain('请补充方案对比。');
    expect(schedulerMock.runCycle).toHaveBeenCalledWith('feedback_reject');
  });

  it('returns prompt content for copying into OpenClaw agents', async () => {
    const { res, data } = await fetchJson('/api/prompt');

    expect(res.status).toBe(200);
    expect(data.content).toContain('你已经接入 `agent-task` 任务系统');
    expect(data.content).toContain('任务创建后会自动在合适的时候调度执行');
  });

  it('builds a chat-agent guidance prompt from strategy summaries', () => {
    const config = readWebuiConfig();
    const prompt = buildChatAgentPrompt({ dataRoot: '/tmp/agent-task', config });

    expect(prompt).toContain('name: agent-task-intake');
    expect(prompt).toContain('负责任务生成与管理。当识别到以下信号');
    expect(prompt).toContain('- 收到 X、微信公众号、博客、新闻文章等内容链接，或用户明确要求研究一篇文章');
    expect(prompt).toContain('agent-task create --title "<title>" --description "<description，可使用简单的 markdown 格式，不要使用标题>"');
    expect(prompt).toContain('| type_id | 任务名称 | 触发方式 | 创建任务前需要做什么 |');
    expect(prompt).not.toContain('report.mp3');
    expect(prompt).not.toContain('任务类型参考：');
  });

  it('renders types_trigger as trigger-only text for intake templates', () => {
    const prompt = buildChatAgentPrompt({
      dataRoot: '/tmp/agent-task',
      config: {
        general: { openclawDefaults: { thinking: 'off', timeoutSeconds: 1800 } },
        chatGuidance: {
          template: ['Desc:', '{{types_trigger}}', 'Alias:', '{{tasks_trigger}}'].join('\n'),
        },
        executionGuidance: {
          template: '',
          common: {},
          strategies: [
            {
              id: 'article_research',
              name: '文章研究',
              triggerCondition: '收到文章链接',
              beforeCreate: '先读文章',
              executionStepsReference: '整理报告',
              openclaw: { timeoutSeconds: 1800 },
            },
          ],
        },
      },
    });

    expect(prompt).toContain('Desc:');
    expect(prompt).toContain('- 收到文章链接');
    expect(prompt).toContain('Alias:');
    expect(prompt).toContain('收到文章链接');
    expect(prompt).not.toContain('先读文章');
    expect(prompt).not.toContain('整理报告');
    expect(prompt).not.toContain('文章研究：');
  });

  it('sends a message to openclaw agent via the API', async () => {
    const { res, data } = await fetchJson('/api/openclaw/agent/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'hello',
        thinking: 'minimal',
        timeoutSeconds: 2400,
      }),
    });

    expect(res.status).toBe(200);
    expect(data.stdout).toContain('写入完成');
    expect(sendAgentMessageMock).toHaveBeenCalledWith({
      sessionId: '',
      agentId: 'main',
      message: 'hello',
      thinking: 'minimal',
      timeoutSeconds: 2400,
    });
  });

  it('returns a server error when openclaw agent command fails', async () => {
    sendAgentMessageMock.mockResolvedValueOnce({
      ok: false,
      code: 1,
      signal: null,
      stdout: '',
      stderr: 'failed',
    });

    const { res, data } = await fetchJson('/api/openclaw/agent/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'chat-main',
        message: 'hello',
      }),
    });

    expect(res.status).toBe(500);
    expect(data.error).toBe('OpenClaw agent command failed');
    expect(data.details.stderr).toBe('failed');
  });

  it('restarts openclaw gateway via the API', async () => {
    const { res, data } = await fetchJson('/api/openclaw/gateway/restart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);
    expect(data.stdout).toContain('gateway restarted');
    expect(restartGatewayMock).toHaveBeenCalled();
  });

  it('installs the rendered agent-task-intake skill into OPENCLAW_HOME', async () => {
    const skillPath = join(tmpDir, 'skills', 'agent-task-intake', 'SKILL.md');

    const { res, data } = await fetchJson('/api/openclaw/skills/agent-task-intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);
    expect(data.stdout).toContain('已写入 agent-task-intake SKILL');
    expect(data.filePath).toBe(skillPath);

    const content = readFileSync(skillPath, 'utf-8');
    expect(content).toContain('name: agent-task-intake');
    expect(content).toContain('必须调用本 SKILL');
    expect(content).toContain('- 收到 X、微信公众号、博客、新闻文章等内容链接，或用户明确要求研究一篇文章');
    expect(content).not.toContain('{{types_trigger}}');
  });

  it('removes the installed agent-task-intake skill from OPENCLAW_HOME', async () => {
    const skillDir = join(tmpDir, 'skills', 'agent-task-intake');
    const skillPath = join(skillDir, 'SKILL.md');
    await fetchJson('/api/openclaw/skills/agent-task-intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const { res, data } = await fetchJson('/api/openclaw/skills/agent-task-intake', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);
    expect(data.stdout).toContain('已移除 agent-task-intake SKILL');
    expect(data.filePath).toBe(skillPath);
    expect(() => readFileSync(skillPath, 'utf-8')).toThrow();
  });

  it('builds an execution reference prompt with common rules and strategy references', () => {
    const config = readWebuiConfig();
    const prompt = buildExecutionReferencePrompt({ config, mode: 'dispatch' });

    expect(prompt).toContain('请执行任务 demo-1234');
    expect(prompt).toContain('最后**必须**生成 report.md、report.html、report.mp3');
    expect(prompt).toContain(config.executionGuidance.strategies[0].name);
    expect(prompt).toContain('expectsCompletionMessage: false');
    expect(prompt).not.toContain('返工说明');
  });

  it('omits empty task type fields in prompt assembly', () => {
    const prompt = buildExecutionReferencePrompt({
      mode: 'dispatch',
      config: {
        general: { openclawDefaults: { thinking: 'off', timeoutSeconds: 1800 } },
        executionGuidance: {
          template: '{{types}}',
          common: {},
          strategies: [
            {
              id: 'article_research',
              name: '文章研究',
              triggerCondition: '',
              beforeCreate: '',
              executionStepsReference: '',
              openclaw: { timeoutSeconds: 1800 },
            },
          ],
        },
      },
    });

    expect(prompt).toContain('1. 文章研究');
    expect(prompt).not.toContain('未填写');
    expect(prompt).not.toContain('适用场景');
    expect(prompt).not.toContain('创建任务前先做什么');
    expect(prompt).not.toContain('处理方式');
  });

  it('accepts an authenticated internal dispatch trigger request', async () => {
    const { res, data } = await fetchJson('/api/internal/dispatch/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ triggerSource: 'task_created' }),
    });

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(schedulerMock.runCycle).toHaveBeenCalledWith('task_created');
  });

  it('returns runtime information for authenticated internal status checks', async () => {
    const { res, data } = await fetchJson('/api/internal/runtime');

    expect(res.status).toBe(200);
    expect(Number.isInteger(data.pid)).toBe(true);
    expect(data.host).toBe('127.0.0.1');
    expect(typeof data.port).toBe('number');
    expect(data.startedAt).toBeTruthy();
  });

  it('rejects file traversal outside workspace root', async () => {
    const task = createTask({ title: 'Traversal test' });
    writeFileSync(join(task.workspace_path, 'note.txt'), 'hello');

    const { res, data } = await fetchJson(`/api/tasks/${task.id}/file?path=../outside.txt`);
    expect(res.status).toBe(400);
    expect(data.error).toContain('workspace root');
  });

  it('serves html reports with sandboxed script execution and no network access', async () => {
    const task = createTask({ title: 'HTML report CSP test' });
    writeFileSync(
      join(task.workspace_path, 'report.html'),
      '<!doctype html><html><head><title>report</title></head><body><script>alert(1)</script><h1>report</h1></body></html>',
    );

    const res = await fetch(`${baseUrl}/api/tasks/${task.id}/open-report`, {
      headers: { Cookie: sessionCookie },
    });
    const html = await res.text();
    const csp = res.headers.get('content-security-policy') || '';

    expect(res.status).toBe(200);
    expect(csp).toContain("script-src 'unsafe-inline'");
    expect(csp).toContain("connect-src 'none'");
    expect(csp).toContain('frame-ancestors');
    expect(csp).toContain('sandbox allow-scripts');
    expect(html).toContain('<h1>report</h1>');
  });

  it('rewrites local html report asset urls to signed asset-token urls', async () => {
    const task = createTask({ title: 'HTML report asset rewrite test' });
    const imageDir = join(task.workspace_path, 'work', 'images');
    mkdirSync(imageDir, { recursive: true });
    writeFileSync(join(imageDir, 'polarization.png'), 'fake-image');
    writeFileSync(
      join(task.workspace_path, 'report.html'),
      '<!doctype html><html><head><title>report</title></head><body><img src="../work/images/polarization.png" alt="chart"></body></html>',
    );

    const reportRes = await fetch(`${baseUrl}/api/tasks/${task.id}/open-report`, {
      headers: { Cookie: sessionCookie },
    });
    const html = await reportRes.text();
    const match = html.match(new RegExp(`/api/tasks/${task.id}/asset-token/([^/]+)/work/images/polarization\\.png`));

    expect(reportRes.status).toBe(200);
    expect(match).toBeTruthy();
    expect(html).not.toContain(`/api/tasks/${task.id}/asset-token/work/images/polarization.png`);

    const imageRes = await fetch(`${baseUrl}${match[0]}`);
    const body = await imageRes.text();

    expect(imageRes.status).toBe(200);
    expect(imageRes.headers.get('content-type')).toContain('image/png');
    expect(body).toBe('fake-image');
  });

  it('rewrites cached external resources only when resource cache is enabled', async () => {
    const task = createTask({ title: 'cached external asset rewrite' });
    const assetName = 'abcdef123456.css';
    const assetsDir = getAssetsDir();
    writeFileSync(join(assetsDir, assetName), 'body { font-family: test; }');
    writeFileSync(
      join(assetsDir, 'manifest.json'),
      JSON.stringify({
        'https://fonts.googleapis.com/css2?family=Manrope:wght@500;700&display=swap': {
          filename: assetName,
          contentType: 'text/css',
          updatedAt: '2026-04-12T00:00:00.000Z',
        },
      }, null, 2),
    );
    writeFileSync(
      join(task.workspace_path, 'report.html'),
      '<!doctype html><html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;700&display=swap"></head><body><h1>report</h1></body></html>',
    );

    const enabledRes = await fetch(`${baseUrl}/api/tasks/${task.id}/open-report`, {
      headers: { Cookie: sessionCookie },
    });
    const enabledHtml = await enabledRes.text();

    expect(enabledRes.status).toBe(200);
    expect(enabledHtml).toContain(`/api/assets/${assetName}`);
    expect(enabledHtml).not.toContain('fonts.googleapis.com/css2');

    await fetchJson('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resourceCache: { enabled: false },
      }),
    });

    const disabledRes = await fetch(`${baseUrl}/api/tasks/${task.id}/open-report`, {
      headers: { Cookie: sessionCookie },
    });
    const disabledHtml = await disabledRes.text();

    expect(disabledRes.status).toBe(200);
    expect(disabledHtml).toContain('fonts.googleapis.com/css2');
    expect(disabledHtml).not.toContain(`/api/assets/${assetName}`);
  });

  it('serves cached assets with a long immutable cache policy', async () => {
    const assetsDir = getAssetsDir();
    const assetName = 'abcdef123456.css';
    writeFileSync(join(assetsDir, assetName), 'body { color: red; }');

    const res = await fetch(`${baseUrl}/api/assets/${assetName}`);
    const css = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/css');
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(css).toContain('color: red');
  });

  it('serves cached image assets with cross-origin resource policy headers', async () => {
    const assetsDir = getAssetsDir();
    const assetName = 'abcdef654321.png';
    writeFileSync(join(assetsDir, assetName), 'fake-image');

    const res = await fetch(`${baseUrl}/api/assets/${assetName}`);
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('image/png');
    expect(res.headers.get('cross-origin-resource-policy')).toBe('cross-origin');
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
    expect(body).toBe('fake-image');
  });

  it('redirects task assets to signed S3 URLs when private S3 storage is enabled', async () => {
    const task = createTask({ title: 'signed task asset' });
    writeFileSync(join(task.workspace_path, 'report.mp3'), 'fake-audio');
    isS3EnabledMock.mockReturnValue(true);
    ensureFileSyncedToS3Mock.mockResolvedValue(true);
    getPresignedUrlMock.mockResolvedValue('https://bucket.example.com/signed-object');

    const res = await fetch(`${baseUrl}/api/tasks/${task.id}/asset/report.mp3`, {
      headers: { Cookie: sessionCookie },
      redirect: 'manual',
    });

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://bucket.example.com/signed-object');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('serves report assets from work/ when html references images/ but files were written under work/images', async () => {
    const task = createTask({ title: 'work asset fallback' });
    const workImagesDir = join(task.workspace_path, 'work', 'images');
    mkdirSync(workImagesDir, { recursive: true });
    writeFileSync(join(workImagesDir, 'diagram.png'), 'fake-image');

    const res = await fetch(`${baseUrl}/api/tasks/${task.id}/asset/images/diagram.png`, {
      headers: { Cookie: sessionCookie },
    });
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('image/png');
    expect(res.headers.get('cache-control')).toBe('private, max-age=1209600');
    expect(res.headers.get('cross-origin-resource-policy')).toBe('cross-origin');
    expect(body).toBe('fake-image');
  });

  it('redirects cached font assets to public S3 URLs with cors headers when S3 is enabled', async () => {
    const assetsDir = getAssetsDir();
    const assetName = 'fedcba654321.woff2';
    writeFileSync(join(assetsDir, assetName), 'fake-font');
    isS3EnabledMock.mockReturnValue(true);
    ensureFileSyncedToS3Mock.mockResolvedValue(true);
    getPublicObjectUrlMock.mockResolvedValue('https://bucket.example.com/public-font.woff2');

    const res = await fetch(`${baseUrl}/api/assets/${assetName}`, {
      redirect: 'manual',
    });

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://bucket.example.com/public-font.woff2');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('cross-origin-resource-policy')).toBe('cross-origin');
  });

  it('serves cached font assets locally with CORS headers when S3 is disabled', async () => {
    const assetsDir = getAssetsDir();
    const assetName = '112233445566.ttf';
    const absPath = join(assetsDir, assetName);
    writeFileSync(absPath, 'fake-ttf');

    const firstRes = await fetch(`${baseUrl}/api/assets/${assetName}`);
    const etag = firstRes.headers.get('etag');

    expect(firstRes.status).toBe(200);
    expect(etag).toBeTruthy();

    const res = await fetch(`${baseUrl}/api/assets/${assetName}`, {
      headers: { 'If-None-Match': etag },
    });

    expect(res.status).toBe(304);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('cross-origin-resource-policy')).toBe('cross-origin');
  });

  it('returns S3 config without accessUrl in the public config payload', async () => {
    const { res, data } = await fetchJson('/api/config');

    expect(res.status).toBe(200);
    expect(data.resourceCache).toEqual({ enabled: true });
    expect(data.s3).toBeTruthy();
    expect('accessUrl' in data.s3).toBe(false);
  });

  it('skips resource scanning when resource cache is disabled', async () => {
    await fetchJson('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resourceCache: { enabled: false },
      }),
    });

    const { res, data } = await fetchJson('/api/storage/scan-resources', {
      method: 'POST',
    });

    expect(res.status).toBe(200);
    expect(data.disabled).toBe(true);
    expect(data.scanned).toBe(0);
    expect(data.cached).toBe(0);
    expect(data.errors).toBe(0);
  });

  it('verifies a draft S3 config without enabling it', async () => {
    const { res, data } = await fetchJson('/api/s3/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        s3: {
          endpoint: 'https://cos.example.com',
          region: 'ap-shanghai',
          bucket: 'demo-bucket',
          accessKeyId: 'draft-key',
          secretAccessKey: 'draft-secret',
          basePath: 'agent-task/',
        },
      }),
    });

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(verifyS3ConnectionMock).toHaveBeenCalledWith(expect.objectContaining({
      endpoint: 'https://cos.example.com',
      bucket: 'demo-bucket',
      secretAccessKey: 'draft-secret',
    }));
    expect(ensureBucketCorsMock).not.toHaveBeenCalled();
    expect(ensureBucketStructureMock).not.toHaveBeenCalled();
  });

  it('configures bucket cors and structure before enabling s3', async () => {
    await fetchJson('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        s3: {
          enabled: false,
          endpoint: 'https://cos.example.com',
          region: 'ap-shanghai',
          bucket: 'demo-bucket',
          accessKeyId: 'draft-key',
          secretAccessKey: 'draft-secret',
          basePath: 'agent-task/',
        },
      }),
    });

    const { res, data } = await fetchJson('/api/s3/enable', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        s3: {
          endpoint: 'https://cos.example.com',
          region: 'ap-shanghai',
          bucket: 'demo-bucket',
          accessKeyId: 'draft-key',
          secretAccessKey: '********',
          basePath: 'agent-task/',
        },
      }),
    });

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(verifyS3ConnectionMock).toHaveBeenCalledWith(expect.objectContaining({
      secretAccessKey: 'draft-secret',
    }));
    expect(ensureBucketCorsMock).toHaveBeenCalledWith(expect.objectContaining({
      bucket: 'demo-bucket',
      secretAccessKey: 'draft-secret',
    }));
    expect(ensureBucketStructureMock).toHaveBeenCalledWith(expect.objectContaining({
      bucket: 'demo-bucket',
      secretAccessKey: 'draft-secret',
    }));
  });

  it('returns config including the resolved data root', async () => {
    const { res, data } = await fetchJson('/api/config');

    expect(res.status).toBe(200);
    expect(data.dataRoot).toBe(tmpDir);
    expect(data.dataRootSource).toBe('AGENT_TASK_HOME');
    expect(data.version).toBe(packageJson.version);
    expect(data.runtimeInfo.host).toBe('127.0.0.1');
  });

  it('returns guidance fields from /api/config', async () => {
    const { res, data } = await fetchJson('/api/config');

    expect(res.status).toBe(200);
    expect(data.general.openclawDefaults.timeoutSeconds).toBe(1800);
    expect(data.chatGuidance.template).toContain('name: agent-task-intake');
    expect(data.executionGuidance.template).toContain('{{#if repair}}');
    expect(data.executionGuidance.common.executionApproach).toBeTruthy();
    expect(Array.isArray(data.executionGuidance.strategies)).toBe(true);
  });

  it('returns both chat and execution prompt previews', async () => {
    const chat = await fetchJson('/api/prompts/chat');
    const execution = await fetchJson('/api/prompts/execution');

    expect(chat.res.status).toBe(200);
    expect(chat.data.content).toContain('agent-task create --title');
    expect(execution.res.status).toBe(200);
    expect(execution.data.content).toContain('请执行任务 demo-1234');
  });

  it('returns prompt template defaults loaded from docs files', async () => {
    const { res, data } = await fetchJson('/api/prompts/defaults');

    expect(res.status).toBe(200);
    expect(data.chat).toBe(readFileSync(join(process.cwd(), 'docs/prompt-templates/agent-intake-skill.md'), 'utf-8').trim());
    expect(data.execution).toBe(readFileSync(join(process.cwd(), 'docs/prompt-templates/agent-execution.md'), 'utf-8').trim());
  });

  it('returns raw prompt template sections for editing', async () => {
    const { res, data } = await fetchJson('/api/prompts/sections?type=chat');

    expect(res.status).toBe(200);
    expect(data.sections[0].content).toContain('name: agent-task-intake');
    expect(data.sections[1].content).toContain('{{types_trigger}}');
    expect(data.sections[1].content).toContain('{{#if hasTask}}');
  });

  it('renders prompt previews from unsaved config and selected conditions', async () => {
    const task = createTask({ title: 'preview task', description: 'preview description' });
    const config = readWebuiConfig();
    config.executionGuidance.template = [
      'Task: {{task.title}}',
      '{{#if repair}}Repair Mode{{/if}}',
      '{{#if hasFeedback}}Feedback: {{feedback.latestHuman.message}}{{/if}}',
    ].join('\n');

    const { res, data } = await fetchJson('/api/prompts/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'execution',
        taskId: task.id,
        useMockTask: false,
        mode: 'repair',
        hasFeedback: true,
        config,
      }),
    });

    expect(res.status).toBe(200);
    expect(data.content).toContain('Task: preview task');
    expect(data.content).toContain('Repair Mode');
    expect(data.content).toContain('请补充证据来源');
  });

  it('updates OpenClaw defaults through /api/config', async () => {
    const update = await fetchJson('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        general: {
          openclawDefaults: {
            thinking: 'minimal',
            timeoutSeconds: 2400,
          },
        },
      }),
    });

    expect(update.res.status).toBe(200);
    expect(update.data.general.openclawDefaults.thinking).toBe('minimal');
    expect(update.data.general.openclawDefaults.timeoutSeconds).toBe(2400);

    const next = await fetchJson('/api/config');
    expect(next.data.general.openclawDefaults.thinking).toBe('minimal');
    expect(next.data.general.openclawDefaults.timeoutSeconds).toBe(2400);
  });

  it('updates resource cache settings through /api/config', async () => {
    const update = await fetchJson('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resourceCache: { enabled: false },
      }),
    });

    expect(update.res.status).toBe(200);
    expect(update.data.resourceCache).toEqual({ enabled: false });

    const next = await fetchJson('/api/config');
    expect(next.data.resourceCache).toEqual({ enabled: false });
  });

  it('drops legacy accessUrl fields when updating S3 config through /api/config', async () => {
    const update = await fetchJson('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        s3: {
          enabled: true,
          endpoint: 'https://cos.example.com',
          accessUrl: 'https://cdn.example.com',
          region: 'ap-guangzhou',
          bucket: 'agent-task',
          accessKeyId: 'test-key',
          secretAccessKey: 'test-secret',
          basePath: 'agent-task/',
        },
      }),
    });

    expect(update.res.status).toBe(200);
    expect(update.data.s3.endpoint).toBe('https://cos.example.com');
    expect(update.data.s3.bucket).toBe('agent-task');
    expect('accessUrl' in update.data.s3).toBe(false);

    const next = await fetchJson('/api/config');
    expect('accessUrl' in next.data.s3).toBe(false);
  });

  it('returns execution snapshot fields on task detail', async () => {
    const task = createTask({ title: 'detail execution fields' });
    const { res, data } = await fetchJson(`/api/tasks/${task.id}`);

    expect(res.status).toBe(200);
    expect(data.dispatch_status).toBe('idle');
    expect(data.timeout_seconds).toBe(1800);
    expect(data.repair_count).toBe(0);
    expect(data.session_key).toBeNull();
  });

  it('returns recent system logs', async () => {
    writeSystemLog('error', 'test-suite', 'Synthetic log entry', { code: 'E_SYNTHETIC' });
    const { res, data } = await fetchJson('/api/system/logs?limit=20');

    expect(res.status).toBe(200);
    expect(data.items.some((item) => item.source === 'test-suite' && item.message === 'Synthetic log entry')).toBe(true);
  });

  it('returns task debug data with run history and related logs', async () => {
    const task = createTask({ title: 'Debug API task' });
    const run = createTaskRun(task.id, {
      kind: 'dispatch',
      status: 'running',
      sessionKey: `task-${task.id}`,
      prompt: 'debug prompt snapshot',
      timeoutSeconds: 1800,
      triggerSource: 'task_created',
      attemptIndex: 1,
    });
    writeSystemLog('info', 'scheduler', 'Automatic dispatch started', {
      taskId: task.id,
      runId: run.id,
      sessionKey: run.session_key,
    });
    writeSystemLog('info', 'scheduler', 'Another task log', {
      taskId: 'other1234',
    });

    const { res, data } = await fetchJson(`/api/tasks/${task.id}/debug`);

    expect(res.status).toBe(200);
    expect(data.summary.id).toBe(task.id);
    expect(data.runs).toHaveLength(1);
    expect(data.runs[0].prompt).toContain('debug prompt snapshot');
    expect(data.logs.some((item) => item.message === 'Automatic dispatch started')).toBe(true);
    expect(data.logs.some((item) => item.message === 'Another task log')).toBe(false);
  });
});
