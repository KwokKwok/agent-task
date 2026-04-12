import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resetDb, getBaseDir, getDb } from '../lib/db.js';
import {
  archiveTask,
  commentTask,
  createTask,
  getTask,
  getTaskEvents,
  getTaskFeedback,
  initWorkspace,
  listTasks,
  rejectTask,
  setStatus,
  updateTaskFeedback,
} from '../lib/task.js';
import { backupReports } from '../lib/workspace.js';
import { createTaskRun, listTaskRuns } from '../lib/task-run.js';

let tmpDir;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'agent-task-test-'));
  process.env.AGENT_TASK_HOME = tmpDir;
});

afterEach(() => {
  resetDb();
  rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.AGENT_TASK_HOME;
});

describe('createTask', () => {
  it('defaults to todo and creates a workspace immediately', () => {
    const task = createTask({ title: '测试记录' });

    expect(task.id).toMatch(/^[0-9a-f]{8}$/);
    expect(task.status).toBe('todo');
    expect(task.workspace_path).toContain(`task-${task.id}`);
    expect(existsSync(task.workspace_path)).toBe(true);
    expect(existsSync(join(task.workspace_path, 'report.md'))).toBe(true);
    expect(existsSync(join(task.workspace_path, 'work', 'report-history'))).toBe(true);
  });

  it('uses the OpenClaw-root default data path when no override is set', () => {
    delete process.env.AGENT_TASK_HOME;
    resetDb();
    process.env.OPENCLAW_HOME = tmpDir;

    expect(getBaseDir()).toBe(join(tmpDir, 'agent-task'));

    delete process.env.OPENCLAW_HOME;
  });

  it('records created and workspace_created events', () => {
    const task = createTask({ title: '事件测试' });
    const events = getTaskEvents(task.id);

    expect(events.map((event) => event.event_type)).toEqual(['created', 'workspace_created']);
  });

  it('stores the provided timeout_seconds on create', () => {
    const task = createTask({ title: '超时测试', timeoutSeconds: 90 });

    expect(task.timeout_seconds).toBe(90);
    expect(getTask(task.id).timeout_seconds).toBe(90);
  });

  it('stores the provided type_id on create', () => {
    const task = createTask({ title: '文章任务', typeId: 'article_research' });

    expect(task.type_id).toBe('article_research');
    expect(getTask(task.id).type_id).toBe('article_research');
  });

  it('normalizes escaped newlines in description text', () => {
    const task = createTask({
      title: '带换行描述',
      description: '第一段\\n\\n第二段\\r\\n- 列表项',
    });

    expect(task.description).toBe('第一段\n\n第二段\n- 列表项');
    expect(getTask(task.id).description).toBe('第一段\n\n第二段\n- 列表项');
  });

  it('rejects unknown type_id values', () => {
    expect(() => createTask({ title: '非法类型', typeId: 'unknown_type' })).toThrow('Invalid type_id');
  });

  it('initializes execution snapshot fields on create', () => {
    const task = createTask({ title: '执行快照默认值' });

    expect(task.dispatch_status).toBe('idle');
    expect(task.repair_count).toBe(0);
    expect(task.session_key).toBeNull();
    expect(task.active_run_id).toBeNull();
    expect(task.last_dispatch_error).toBeNull();
  });
});

describe('status flow', () => {
  it('supports todo -> in_progress -> done -> archived', () => {
    const task = createTask({ title: '生命周期' });

    const active = setStatus(task.id, 'in_progress');
    const done = setStatus(task.id, 'done');
    const archived = archiveTask(task.id);

    expect(active.status).toBe('in_progress');
    expect(done.status).toBe('done');
    expect(archived.status).toBe('archived');
    expect(archived.workspace_path).toContain('.tar.gz');
  });

  it('allows done -> todo when a record needs follow-up', () => {
    const task = createTask({ title: '返工' });

    setStatus(task.id, 'done');
    const reopened = setStatus(task.id, 'todo');

    expect(reopened.status).toBe('todo');
  });

  it('completes the active run when marking a running task as done', () => {
    const task = createTask({ title: '完成时收口 run' });
    const run = createTaskRun(task.id, {
      kind: 'dispatch',
      status: 'running',
      taskStatus: 'in_progress',
      sessionKey: `task-${task.id}`,
      prompt: 'dispatch prompt',
      timeoutSeconds: 1800,
      triggerSource: 'interval',
      attemptIndex: 1,
    });

    const done = setStatus(task.id, 'done');
    const stored = getTask(task.id);
    const latestRun = listTaskRuns(task.id).find((item) => item.id === run.id);

    expect(done.status).toBe('done');
    expect(stored.active_run_id).toBeNull();
    expect(stored.dispatch_status).toBe('completed');
    expect(latestRun?.status).toBe('completed');
    expect(latestRun?.finished_at).toBeTruthy();
  });

  it('filters archived records out of the default list', () => {
    const task = createTask({ title: '归档项' });
    setStatus(task.id, 'done');
    archiveTask(task.id);

    expect(listTasks()).toEqual([]);
    expect(listTasks({ all: true })).toHaveLength(1);
  });

  it('normalizes escaped newlines for existing stored descriptions when listing', () => {
    const db = getDb();
    db.prepare(`
      INSERT INTO tasks (
        id,
        title,
        description,
        status,
        priority,
        workspace_path,
        timeout_seconds,
        dispatch_status,
        repair_count,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, 'todo', 'medium', ?, 1800, 'idle', 0, ?, ?)
    `).run(
      'legacy001',
      '历史任务',
      '核心内容\\n\\n第二段',
      join(tmpDir, 'tasks', 'legacy001'),
      '2026-04-07T00:00:00.000Z',
      '2026-04-07T00:00:00.000Z',
    );

    expect(getTask('legacy001')?.description).toBe('核心内容\n\n第二段');
    expect(listTasks().find((task) => task.id === 'legacy001')?.description).toBe('核心内容\n\n第二段');
  });

  it('repairs stale workspace_path values when the same task exists under the current data root', () => {
    const task = createTask({ title: '旧路径修复' });
    const stalePath = task.workspace_path.replace(tmpDir, '/root/.openclaw/agent-task');
    const db = getDb();

    db.prepare('UPDATE tasks SET workspace_path = ? WHERE id = ?').run(stalePath, task.id);

    const repaired = getTask(task.id);
    const listed = listTasks({ all: true }).find((item) => item.id === task.id);
    const storedPath = db.prepare('SELECT workspace_path FROM tasks WHERE id = ?').get(task.id).workspace_path;

    expect(repaired.workspace_path).toBe(task.workspace_path);
    expect(listed?.workspace_path).toBe(task.workspace_path);
    expect(storedPath).toBe(task.workspace_path);
  });

  it('repairs stale workspace_path values when legacy paths use Windows separators', () => {
    const task = createTask({ title: 'Windows 旧路径修复' });
    const stalePath = task.workspace_path
      .replaceAll('/', '\\')
      .replace(tmpDir.replaceAll('/', '\\'), 'C:\\Users\\demo\\.openclaw\\agent-task');
    const db = getDb();

    db.prepare('UPDATE tasks SET workspace_path = ? WHERE id = ?').run(stalePath, task.id);

    const repaired = getTask(task.id);
    const listed = listTasks({ all: true }).find((item) => item.id === task.id);
    const storedPath = db.prepare('SELECT workspace_path FROM tasks WHERE id = ?').get(task.id).workspace_path;

    expect(repaired.workspace_path).toBe(task.workspace_path);
    expect(listed?.workspace_path).toBe(task.workspace_path);
    expect(storedPath).toBe(task.workspace_path);
  });
});

describe('workspace helpers', () => {
  it('initWorkspace is idempotent', () => {
    const task = createTask({ title: '工作区测试' });
    const first = initWorkspace(task.id);
    const second = initWorkspace(task.id);

    expect(first.workspace_path).toBe(second.workspace_path);
  });

  it('backs up current report files before overwrite', () => {
    const task = createTask({ title: '备份测试' });
    writeFileSync(join(task.workspace_path, 'report.md'), '# v1\n');
    writeFileSync(join(task.workspace_path, 'report.html'), '<h1>v1</h1>');

    const paths = backupReports(task.workspace_path);
    const files = readdirSync(join(task.workspace_path, 'work', 'report-history'));

    expect(paths).toHaveLength(2);
    expect(files.some((name) => name.startsWith('report-') && name.endsWith('.md'))).toBe(true);
    expect(files.some((name) => name.startsWith('report-') && name.endsWith('.html'))).toBe(true);
  });
});

describe('feedback', () => {
  it('renders reject/comment/update into a readable markdown summary', () => {
    const task = createTask({ title: '反馈测试' });

    rejectTask(task.id, '当前报告不通过，需要补充方案对比。');
    commentTask(task.id, '结论部分还要更具体。');
    updateTaskFeedback(task.id, '已补充方案对比并重写结论。', {
      backupPaths: ['work/report-history/report-1.md'],
    });

    const feedback = getTaskFeedback(task.id);

    expect(feedback.items).toHaveLength(3);
    expect(feedback.content).toContain('Current Status: todo');
    expect(feedback.content).toContain('当前报告不通过，需要补充方案对比。');
    expect(feedback.content).toContain('已补充方案对比并重写结论。');
    expect(feedback.content).toContain('work/report-history/report-1.md');
  });

  it('rejectTask records a feedback event and keeps the record at todo', () => {
    const task = createTask({ title: '拒绝测试' });
    setStatus(task.id, 'done');

    rejectTask(task.id, '需要继续修改。');

    expect(getTask(task.id).status).toBe('todo');
    expect(getTaskEvents(task.id).at(-1).event_type).toBe('feedback_reject');
  });
});

describe('archive guards', () => {
  it('rejects archiving records that are not done', () => {
    const task = createTask({ title: '非法归档' });
    expect(() => archiveTask(task.id)).toThrow('Cannot archive: task is "todo"');
  });

  it('throws on unknown record ids', () => {
    expect(() => getTaskFeedback('nope')).toThrow('Task not found: nope');
  });

  it('keeps task sidecar in sync after status changes', () => {
    const task = createTask({ title: 'sidecar' });
    setStatus(task.id, 'in_progress');
    const sidecar = JSON.parse(readFileSync(join(task.workspace_path, 'task.json'), 'utf-8'));

    expect(sidecar.status).toBe('in_progress');
  });
});
