import { EventEmitter } from 'node:events';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const { spawnMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
}));

vi.mock('node:child_process', async () => {
  const actual = await vi.importActual('node:child_process');
  return {
    ...actual,
    spawn: spawnMock,
  };
});

import { getDb, resetDb } from '../lib/db.js';
import { commentTask, createTask, getTask } from '../lib/task.js';
import { createTaskRun } from '../lib/task-run.js';
import { readSystemLogs } from '../lib/webui/system-log.js';
import {
  buildDispatchPrompt,
  buildRepairPrompt,
  invokeOpenClawAgent,
  resolveOpenClawSpawnEnv,
} from '../lib/openclaw-dispatch.js';
import { createScheduler } from '../lib/webui/scheduler.js';

let tmpDir;
let originalHome;
let originalPath;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'agent-task-scheduler-test-'));
  process.env.AGENT_TASK_HOME = tmpDir;
  originalHome = process.env.HOME;
  originalPath = process.env.PATH;
  spawnMock.mockReset();
});

afterEach(() => {
  resetDb();
  rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.AGENT_TASK_HOME;
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
  if (originalPath === undefined) delete process.env.PATH;
  else process.env.PATH = originalPath;
});

describe('openclaw dispatch integration', () => {
  it('builds a dispatch prompt with task id, workspace, session key, and timeout', () => {
    const task = createTask({ title: 'dispatch prompt', description: 'write report' });
    const prompt = buildDispatchPrompt(task, {
      sessionKey: `task-${task.id}`,
      timeoutSeconds: task.timeout_seconds,
    });

    expect(prompt).toContain(`任务 ${task.id}`);
    expect(prompt).toContain(task.workspace_path);
    expect(prompt).toContain(`Session Key: task-${task.id}`);
    expect(prompt).toContain(`Timeout: ${task.timeout_seconds}s`);
    expect(prompt).toContain(`agent-task status ${task.id} done`);
    expect(prompt).toContain('最后**必须**生成 report.md、report.html、report.mp3');
    expect(prompt).toContain('通过 `message` 工具发飞书卡片消息给用户（green 主题，需要包含两个按钮：查看网页报告、查看文字报告');
    expect(prompt).toContain('expectsCompletionMessage: false');
    expect(prompt).toContain('执行类型参考');
    expect(prompt).not.toContain('返工说明');
    expect(prompt).not.toContain('用户反馈');
    expect(prompt).not.toContain(`agent-task feedback update ${task.id} --message "..." --backup`);
  });

  it('builds a dispatch prompt with only the selected task type when type_id is set', () => {
    const task = createTask({ title: '研究文章', description: 'write report', typeId: 'article_research' });
    const prompt = buildDispatchPrompt(task, {
      sessionKey: `task-${task.id}`,
      timeoutSeconds: task.timeout_seconds,
      config: {
        general: { openclawDefaults: { thinking: 'off', timeoutSeconds: 1800 } },
        executionGuidance: {
          template: [
            'Type ID: {{task.type_id}}',
            '{{types}}',
          ].join('\n'),
          common: {},
          strategies: [
            {
              id: 'article_research',
              name: '文章研究',
              triggerCondition: '收到文章链接',
              beforeCreate: '创建文章研究任务',
              executionStepsReference: '总结文章',
              openclaw: { timeoutSeconds: 1800 },
            },
          ],
        },
      },
    });

    expect(prompt).toContain('Type ID: article_research');
    expect(prompt).toContain('1. 文章研究');
    expect(prompt).not.toContain('网页交付');
  });

  it('builds a repair prompt with workspace and feedback summary', () => {
    const task = createTask({ title: 'repair prompt', description: 'fix report' });
    commentTask(task.id, '请补充证据。');

    const prompt = buildRepairPrompt(task, {
      sessionKey: `task-${task.id}`,
      timeoutSeconds: task.timeout_seconds,
    });

    expect(prompt).toContain(`任务 ${task.id}`);
    expect(prompt).toContain(task.workspace_path);
    expect(prompt).toContain(`Session Key: task-${task.id}`);
    expect(prompt).toContain('请补充证据。');
    expect(prompt).toContain('执行情况说明');
    expect(prompt).toContain('返工说明');
    expect(prompt).toContain(`agent-task feedback update ${task.id} --message "..." --backup`);
  });

  it('builds a dispatch prompt with injected feedback when task already has feedback', () => {
    const task = createTask({ title: 'dispatch with feedback', description: 'revise report' });
    commentTask(task.id, '请补充数据来源。');

    const prompt = buildDispatchPrompt(task, {
      sessionKey: `task-${task.id}`,
      timeoutSeconds: task.timeout_seconds,
    });

    expect(prompt).toContain('返工说明');
    expect(prompt).toContain('请补充数据来源。');
    expect(prompt).toContain(`agent-task feedback update ${task.id} --message "..." --backup`);
  });

  it('invokes openclaw agent with the expected command line', async () => {
    const child = new EventEmitter();
    child.once = child.once.bind(child);
    spawnMock.mockReturnValue(child);

    const promise = invokeOpenClawAgent({
      sessionKey: 'task-12345678',
      prompt: 'hello',
    });

    child.emit('spawn');
    await promise;

    expect(spawnMock).toHaveBeenCalledWith(
      'openclaw',
      ['agent', '--session-id', 'task-12345678', '--message', 'hello', '--thinking', 'off', '--timeout', '1800'],
      expect.objectContaining({ stdio: 'ignore' }),
    );
  });

  it('falls back to systemd service PATH when current PATH cannot find openclaw', () => {
    const fakeHome = join(tmpDir, 'home');
    const fakeBinDir = join(fakeHome, '.bun/bin');
    const systemdDir = join(fakeHome, '.config/systemd/user');
    mkdirSync(fakeBinDir, { recursive: true });
    mkdirSync(systemdDir, { recursive: true });
    writeFileSync(join(fakeBinDir, 'openclaw'), '');
    writeFileSync(join(systemdDir, 'openclaw-gateway.service'), [
      '[Service]',
      `Environment=PATH=${fakeBinDir}:/usr/local/bin:/usr/bin`,
      '',
    ].join('\n'));

    process.env.HOME = fakeHome;
    process.env.PATH = '/usr/local/bin:/usr/bin';

    const env = resolveOpenClawSpawnEnv();

    expect(env.PATH.split(':')).toContain(fakeBinDir);
  });

  it('passes task timeout to openclaw when task-level timeout exists', async () => {
    createTask({ title: 'timeout task', timeoutSeconds: 900 });
    const invokeAgent = vi.fn().mockResolvedValue(undefined);
    const scheduler = createScheduler({
      intervalMs: 30000,
      maxConcurrent: 1,
      invokeAgent,
    });

    await scheduler.runCycle('task_created');

    expect(invokeAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        timeoutSeconds: 900,
      }),
    );
  });

  it('passes strategy timeout when task-level timeout is absent from the runtime context', async () => {
    createTask({ title: 'strategy timeout task' });
    const invokeAgent = vi.fn().mockResolvedValue(undefined);
    const scheduler = createScheduler({
      intervalMs: 30000,
      maxConcurrent: 1,
      invokeAgent,
      config: {
        general: { openclawDefaults: { thinking: 'off', timeoutSeconds: 1800 } },
        executionGuidance: {
          common: {},
          strategies: [
            {
              id: 'article_research',
              name: '文章研究',
              triggerCondition: '收到文章链接',
              beforeCreate: '创建文章研究任务',
              executionStepsReference: '总结文章',
              openclaw: { timeoutSeconds: 2400 },
            },
          ],
        },
      },
    });

    await scheduler.runCycle('interval');

    expect(invokeAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        timeoutSeconds: 2400,
        thinking: 'off',
      }),
    );
  });

  it('prefers the explicit task type timeout when type_id is set', async () => {
    createTask({ title: 'typed task', typeId: 'article_research' });
    const invokeAgent = vi.fn().mockResolvedValue(undefined);
    const scheduler = createScheduler({
      intervalMs: 30000,
      maxConcurrent: 1,
      invokeAgent,
      config: {
        general: { openclawDefaults: { thinking: 'off', timeoutSeconds: 1800 } },
        executionGuidance: {
          common: {},
          strategies: [
            {
              id: 'article_research',
              name: '文章研究',
              triggerCondition: '收到文章链接',
              beforeCreate: '创建文章研究任务',
              executionStepsReference: '总结文章',
              openclaw: { timeoutSeconds: 1200 },
            },
          ],
        },
      },
    });

    await scheduler.runCycle('interval');

    expect(invokeAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        timeoutSeconds: 1200,
      }),
    );
  });

  it('moves one todo task to in_progress and dispatches it', async () => {
    const task = createTask({ title: 'auto dispatch me' });
    const invokeAgent = vi.fn().mockResolvedValue(undefined);
    const scheduler = createScheduler({
      intervalMs: 30000,
      maxConcurrent: 1,
      invokeAgent,
    });

    const result = await scheduler.runCycle('task_created');

    expect(result.dispatched).toBe(1);
    expect(invokeAgent).toHaveBeenCalledTimes(1);
    expect(getTask(task.id).status).toBe('in_progress');
    expect(getTask(task.id).dispatch_status).toBe('running');
  });

  it('does not dispatch more tasks than maxConcurrent allows', async () => {
    createTask({ title: 'one' });
    createTask({ title: 'two' });
    const invokeAgent = vi.fn().mockResolvedValue(undefined);
    const scheduler = createScheduler({
      intervalMs: 30000,
      maxConcurrent: 1,
      invokeAgent,
    });

    const result = await scheduler.runCycle('interval');

    expect(result.dispatched).toBe(1);
    expect(invokeAgent).toHaveBeenCalledTimes(1);
  });

  it('writes scheduler system logs for dispatch activity', async () => {
    createTask({ title: 'logged dispatch' });
    const invokeAgent = vi.fn().mockResolvedValue(undefined);
    const scheduler = createScheduler({
      intervalMs: 30000,
      maxConcurrent: 1,
      invokeAgent,
    });

    await scheduler.runCycle('task_created');

    const logs = readSystemLogs(20).items.filter((item) => item.source === 'scheduler');
    expect(logs.some((item) => item.message === 'Automatic dispatch started')).toBe(true);
    expect(logs.some((item) => item.message === 'Scheduler cycle completed')).toBe(true);
  });

  it('marks timed-out runs and starts one repair attempt', async () => {
    const task = createTask({ title: 'repair me', status: 'in_progress', timeoutSeconds: 30 });
    const run = createTaskRun(task.id, {
      kind: 'dispatch',
      status: 'running',
      sessionKey: `task-${task.id}`,
      prompt: 'dispatch prompt',
      timeoutSeconds: 30,
      triggerSource: 'interval',
      attemptIndex: 1,
    });

    getDb().prepare(`
      UPDATE task_runs
      SET started_at = datetime('now', '-31 seconds')
      WHERE id = ?
    `).run(run.id);

    const invokeAgent = vi.fn().mockResolvedValue(undefined);
    const scheduler = createScheduler({
      intervalMs: 30000,
      maxConcurrent: 2,
      invokeAgent,
    });
    const result = await scheduler.runCycle('interval');

    expect(result.repaired).toBe(1);
    expect(invokeAgent).toHaveBeenCalledTimes(1);
    expect(getTask(task.id).dispatch_status).toBe('repairing');
    expect(getTask(task.id).repair_count).toBe(1);
  });

  it('does not auto-repair a second time after repair_count reaches one', async () => {
    const task = createTask({ title: 'no second repair', status: 'in_progress', timeoutSeconds: 30 });
    const run = createTaskRun(task.id, {
      kind: 'dispatch',
      status: 'running',
      sessionKey: `task-${task.id}`,
      prompt: 'dispatch prompt',
      timeoutSeconds: 30,
      triggerSource: 'interval',
      attemptIndex: 1,
    });

    getDb().prepare(`
      UPDATE task_runs
      SET started_at = datetime('now', '-31 seconds')
      WHERE id = ?
    `).run(run.id);
    getDb().prepare(`
      UPDATE tasks
      SET repair_count = 1
      WHERE id = ?
    `).run(task.id);

    const invokeAgent = vi.fn().mockResolvedValue(undefined);
    const scheduler = createScheduler({
      intervalMs: 30000,
      maxConcurrent: 2,
      invokeAgent,
    });
    const result = await scheduler.runCycle('interval');

    expect(result.repaired).toBe(0);
    expect(invokeAgent).toHaveBeenCalledTimes(0);
    expect(getTask(task.id).dispatch_status).toBe('repair_exhausted');
  });
});
