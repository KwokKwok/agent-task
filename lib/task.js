import { randomUUID } from 'node:crypto';
import { getDb } from './db.js';
import {
  archiveWorkspace,
  createWorkspace,
  getWorkspacePath,
  syncTaskJson,
} from './workspace.js';
import { existsSync } from 'node:fs';
import { addFeedback, listFeedback, renderFeedbackMarkdown } from './feedback.js';
import { ensureValidTaskTypeId } from './task-type.js';
import { completeTaskRun } from './task-run.js';

export const VALID_STATUSES = new Set([
  'todo',
  'in_progress',
  'done',
  'archived',
]);

const ALLOWED_TRANSITIONS = {
  todo: ['in_progress', 'done', 'archived'],
  in_progress: ['todo', 'done', 'archived'],
  done: ['todo', 'in_progress', 'archived'],
  archived: ['todo', 'in_progress', 'done'],
};

export const DEFAULT_TASK_TIMEOUT_SECONDS = 1800;

function now() {
  return new Date().toISOString();
}

function normalizeDescriptionText(description) {
  if (description == null) return null;
  return String(description)
    .replace(/\r\n/g, '\n')
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\n');
}

function normalizeTaskRecord(task) {
  if (!task) return null;
  return {
    ...task,
    description: normalizeDescriptionText(task.description),
  };
}

function ensureValidStatus(status) {
  if (!VALID_STATUSES.has(status)) {
    throw new Error(`Invalid status: ${status}. Valid: ${[...VALID_STATUSES].join(', ')}`);
  }
}

function normalizeTimeoutSeconds(value) {
  if (value == null) return DEFAULT_TASK_TIMEOUT_SECONDS;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`Invalid timeout_seconds: ${value}`);
  }
  return n;
}

export function addEvent(taskId, eventType, message) {
  const db = getDb();
  db.prepare(`
    INSERT INTO task_events (task_id, event_type, message, created_at)
    VALUES (?, ?, ?, ?)
  `).run(taskId, eventType, message || null, now());
}

export function getTask(id) {
  const db = getDb();
  return normalizeTaskRecord(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id));
}

function persistWorkspace(task) {
  const workspacePath = task.workspace_path && existsSync(task.workspace_path)
    ? task.workspace_path
    : createWorkspace(task.id, task);
  const db = getDb();
  db.prepare('UPDATE tasks SET workspace_path = ?, updated_at = ? WHERE id = ?')
    .run(workspacePath, task.updated_at, task.id);
  const updated = getTask(task.id);
  syncTaskJson(updated.workspace_path, updated);
  return updated;
}

export function createTask({ title, description, priority, status, timeoutSeconds, typeId } = {}) {
  const db = getDb();
  const id = randomUUID().slice(0, 8);
  const timestamp = now();
  const initialStatus = status || 'todo';
  const timeout = normalizeTimeoutSeconds(timeoutSeconds);
  const normalizedTypeId = ensureValidTaskTypeId(typeId);
  const normalizedDescription = normalizeDescriptionText(description);

  ensureValidStatus(initialStatus);

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
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'idle', 0, ?, ?)
  `).run(
    id,
    title,
    normalizedDescription,
    normalizedTypeId,
    initialStatus,
    priority || 'medium',
    getWorkspacePath(id),
    timeout,
    timestamp,
    timestamp,
  );

  addEvent(id, 'created', `Worklog created: ${title}`);
  addEvent(id, 'workspace_created', `Workspace ready: ${getWorkspacePath(id)}`);
  return persistWorkspace(getTask(id));
}

export function initWorkspace(id) {
  const task = getTask(id);
  if (!task) {
    throw new Error(`Task not found: ${id}`);
  }
  if (task.workspace_path) {
    return persistWorkspace(task);
  }
  return persistWorkspace({ ...task, updated_at: now() });
}

export function setStatus(id, newStatus, message) {
  ensureValidStatus(newStatus);

  const db = getDb();
  const task = getTask(id);
  if (!task) {
    throw new Error(`Task not found: ${id}`);
  }
  if (task.status === newStatus) {
    return task;
  }

  const allowed = ALLOWED_TRANSITIONS[task.status] || [];
  if (!allowed.includes(newStatus)) {
    throw new Error(
      `Cannot transition from "${task.status}" to "${newStatus}". Allowed: [${allowed.join(', ')}]`,
    );
  }

  const timestamp = now();
  db.prepare(`
    UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?
  `).run(newStatus, timestamp, id);

  addEvent(id, 'status_changed', message || `${task.status} → ${newStatus}`);

  if (newStatus === 'done' && task.active_run_id != null) {
    const activeRun = db.prepare('SELECT status FROM task_runs WHERE id = ?').get(task.active_run_id);
    if (activeRun?.status === 'running') {
      completeTaskRun(task.active_run_id);
    }
  }

  return persistWorkspace(getTask(id));
}

export function listTasks({ status, all } = {}) {
  const db = getDb();
  if (status && status !== 'all') {
    return db.prepare('SELECT * FROM tasks WHERE status = ? ORDER BY updated_at DESC')
      .all(status)
      .map(normalizeTaskRecord);
  }
  if (!all) {
    return db.prepare('SELECT * FROM tasks WHERE status != ? ORDER BY updated_at DESC')
      .all('archived')
      .map(normalizeTaskRecord);
  }
  return db.prepare('SELECT * FROM tasks ORDER BY updated_at DESC').all().map(normalizeTaskRecord);
}

export function incrementTaskRepairCount(id) {
  const task = getTask(id);
  if (!task) {
    throw new Error(`Task not found: ${id}`);
  }

  const db = getDb();
  const timestamp = now();
  db.prepare(`
    UPDATE tasks
    SET repair_count = repair_count + 1,
        updated_at = ?
    WHERE id = ?
  `).run(timestamp, id);

  return getTask(id);
}

export function archiveTask(id) {
  const task = getTask(id);
  if (!task) {
    throw new Error(`Task not found: ${id}`);
  }
  if (task.status !== 'done') {
    throw new Error(`Cannot archive: task is "${task.status}", expected "done"`);
  }

  const db = getDb();
  const timestamp = now();
  let archivePath = null;
  if (task.workspace_path) {
    archivePath = archiveWorkspace(id, task.workspace_path);
  }

  db.prepare('UPDATE tasks SET status = ?, workspace_path = ?, updated_at = ? WHERE id = ?')
    .run('archived', archivePath, timestamp, id);

  addEvent(id, 'archived', `Archived${archivePath ? `: ${archivePath}` : ''}`);
  return getTask(id);
}

export function getTaskEvents(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM task_events WHERE task_id = ? ORDER BY created_at ASC, id ASC').all(id);
}

export function rejectTask(id, message) {
  const task = getTask(id);
  if (!task) {
    throw new Error(`Task not found: ${id}`);
  }
  const nextStatus = task.status === 'archived' ? 'todo' : task.status === 'todo' ? 'todo' : 'todo';
  if (task.status !== 'todo') {
    setStatus(id, nextStatus, 'Returned to todo for follow-up');
  }
  const item = addFeedback(id, {
    actor: 'human',
    kind: 'reject',
    message: String(message || '').trim() || 'Current result was rejected and needs follow-up.',
  });
  addEvent(id, 'feedback_reject', item.message);
  return item;
}

export function commentTask(id, message) {
  const task = getTask(id);
  if (!task) {
    throw new Error(`Task not found: ${id}`);
  }
  const item = addFeedback(id, {
    actor: 'human',
    kind: 'comment',
    message,
  });
  addEvent(id, 'feedback_comment', item.message);
  return item;
}

export function updateTaskFeedback(id, message, meta) {
  const task = getTask(id);
  if (!task) {
    throw new Error(`Task not found: ${id}`);
  }
  const item = addFeedback(id, {
    actor: 'ai',
    kind: 'update',
    message,
    meta,
  });
  addEvent(id, 'feedback_update', item.message);
  return item;
}

export function getTaskFeedback(id) {
  const task = getTask(id);
  if (!task) {
    throw new Error(`Task not found: ${id}`);
  }
  const items = listFeedback(id);
  return {
    task,
    items,
    content: renderFeedbackMarkdown(task, items),
  };
}
