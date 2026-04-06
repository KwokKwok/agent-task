import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { getDb, resetDb } from '../lib/db.js';
import { createTask, getTask } from '../lib/task.js';
import {
  completeTaskRun,
  createRepairRunFromTimedOut,
  createTaskRun,
  failTaskRunDispatch,
  listTimedOutRunningTasks,
  markTaskRunTimedOut,
} from '../lib/task-run.js';

let tmpDir;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'agent-task-run-test-'));
  process.env.AGENT_TASK_HOME = tmpDir;
});

afterEach(() => {
  resetDb();
  rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.AGENT_TASK_HOME;
});

describe('task run persistence', () => {
  it('creates a running dispatch row and syncs the task snapshot', () => {
    const task = createTask({ title: 'dispatch row' });
    const run = createTaskRun(task.id, {
      kind: 'dispatch',
      status: 'running',
      sessionKey: `task-${task.id}`,
      prompt: 'dispatch prompt',
      timeoutSeconds: 1800,
      triggerSource: 'task_created',
      attemptIndex: 1,
    });

    const stored = getTask(task.id);
    expect(run.kind).toBe('dispatch');
    expect(run.status).toBe('running');
    expect(stored.active_run_id).toBe(run.id);
    expect(stored.dispatch_status).toBe('running');
    expect(stored.session_key).toBe(`task-${task.id}`);
    expect(stored.last_dispatch_error).toBeNull();
  });

  it('marks a run completed and clears active snapshot pointers', () => {
    const task = createTask({ title: 'complete row' });
    const run = createTaskRun(task.id, {
      kind: 'dispatch',
      status: 'running',
      sessionKey: `task-${task.id}`,
      prompt: 'dispatch prompt',
      timeoutSeconds: 1800,
      triggerSource: 'interval',
      attemptIndex: 1,
    });

    const completed = completeTaskRun(run.id);
    const stored = getTask(task.id);

    expect(completed.status).toBe('completed');
    expect(completed.finished_at).toBeTruthy();
    expect(stored.active_run_id).toBeNull();
    expect(stored.dispatch_started_at).toBeNull();
    expect(stored.dispatch_timeout_seconds).toBeNull();
    expect(stored.dispatch_status).toBe('completed');
  });

  it('marks a run dispatch_failed and returns the task to todo', () => {
    const task = createTask({ title: 'failed row', status: 'in_progress' });
    const run = createTaskRun(task.id, {
      kind: 'dispatch',
      status: 'running',
      sessionKey: `task-${task.id}`,
      prompt: 'dispatch prompt',
      timeoutSeconds: 1800,
      triggerSource: 'interval',
      attemptIndex: 1,
    });

    const failed = failTaskRunDispatch(run.id, 'spawn failed');
    const stored = getTask(task.id);

    expect(failed.status).toBe('dispatch_failed');
    expect(failed.error_message).toBe('spawn failed');
    expect(stored.status).toBe('todo');
    expect(stored.active_run_id).toBeNull();
    expect(stored.dispatch_status).toBe('dispatch_failed');
    expect(stored.last_dispatch_error).toBe('spawn failed');
  });

  it('finds timed-out running tasks and marks them timed_out', () => {
    const task = createTask({ title: 'timed out row', status: 'in_progress', timeoutSeconds: 30 });
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

    const timedOut = listTimedOutRunningTasks();
    const updatedRun = markTaskRunTimedOut(run.id);
    const stored = getTask(task.id);

    expect(timedOut).toHaveLength(1);
    expect(timedOut[0].id).toBe(task.id);
    expect(updatedRun.status).toBe('timed_out');
    expect(stored.active_run_id).toBeNull();
    expect(stored.dispatch_status).toBe('timed_out');
  });

  it('atomically replaces a timed-out run with a repair run', () => {
    const task = createTask({ title: 'repair row', status: 'in_progress', timeoutSeconds: 30 });
    const timedOutRun = createTaskRun(task.id, {
      kind: 'dispatch',
      status: 'running',
      sessionKey: `task-${task.id}`,
      prompt: 'dispatch prompt',
      timeoutSeconds: 30,
      triggerSource: 'interval',
      attemptIndex: 1,
    });

    const repairRun = createRepairRunFromTimedOut(task.id, timedOutRun.id, {
      kind: 'repair',
      status: 'running',
      snapshotStatus: 'repairing',
      sessionKey: `task-${task.id}`,
      prompt: 'repair prompt',
      timeoutSeconds: 30,
      triggerSource: 'interval',
      attemptIndex: 1,
    });

    const timedOutStored = getDb().prepare('SELECT * FROM task_runs WHERE id = ?').get(timedOutRun.id);
    const stored = getTask(task.id);

    expect(timedOutStored.status).toBe('timed_out');
    expect(timedOutStored.finished_at).toBeTruthy();
    expect(repairRun.status).toBe('running');
    expect(repairRun.repair_of_run_id).toBe(timedOutRun.id);
    expect(stored.active_run_id).toBe(repairRun.id);
    expect(stored.dispatch_status).toBe('repairing');
    expect(stored.repair_count).toBe(1);
  });
});
