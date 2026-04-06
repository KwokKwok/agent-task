import { getDb } from './db.js';

function now() {
  return new Date().toISOString();
}

function getTaskRun(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM task_runs WHERE id = ?').get(id) || null;
}

export function listTaskRuns(taskId) {
  const db = getDb();
  return db.prepare(`
    SELECT *
    FROM task_runs
    WHERE task_id = ?
    ORDER BY started_at DESC, id DESC
  `).all(taskId);
}

export function createTaskRun(taskId, input) {
  const db = getDb();
  const startedAt = now();
  const snapshotStatus = input.snapshotStatus || input.status;
  const runId = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO task_runs (
        task_id,
        kind,
        status,
        session_key,
        prompt,
        timeout_seconds,
        started_at,
        trigger_source,
        attempt_index,
        repair_of_run_id,
        error_message
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      taskId,
      input.kind,
      input.status,
      input.sessionKey,
      input.prompt,
      input.timeoutSeconds,
      startedAt,
      input.triggerSource,
      input.attemptIndex,
      input.repairOfRunId || null,
      input.errorMessage || null,
    );

    if (input.taskStatus !== undefined) {
      db.prepare(`
        UPDATE tasks
        SET status = ?,
            active_run_id = ?,
            dispatch_started_at = ?,
            dispatch_timeout_seconds = ?,
            dispatch_status = ?,
            session_key = ?,
            last_dispatch_error = NULL,
            updated_at = ?
        WHERE id = ?
      `).run(
        input.taskStatus,
        result.lastInsertRowid,
        startedAt,
        input.timeoutSeconds,
        snapshotStatus,
        input.sessionKey,
        startedAt,
        taskId,
      );
    } else {
      db.prepare(`
        UPDATE tasks
        SET active_run_id = ?,
            dispatch_started_at = ?,
            dispatch_timeout_seconds = ?,
            dispatch_status = ?,
            session_key = ?,
            last_dispatch_error = NULL,
            updated_at = ?
        WHERE id = ?
      `).run(
        result.lastInsertRowid,
        startedAt,
        input.timeoutSeconds,
        snapshotStatus,
        input.sessionKey,
        startedAt,
        taskId,
      );
    }

    return result.lastInsertRowid;
  })();

  return getTaskRun(runId);
}

export function createRepairRunFromTimedOut(taskId, timedOutRunId, input) {
  const db = getDb();
  const timedOutRun = getTaskRun(timedOutRunId);
  if (!timedOutRun) {
    throw new Error(`Task run not found: ${timedOutRunId}`);
  }
  if (timedOutRun.task_id !== taskId) {
    throw new Error(`Task run ${timedOutRunId} does not belong to task ${taskId}`);
  }

  const startedAt = now();
  const snapshotStatus = input.snapshotStatus || input.status;
  const runId = db.transaction(() => {
    db.prepare(`
      UPDATE task_runs
      SET status = ?, finished_at = ?
      WHERE id = ?
    `).run('timed_out', startedAt, timedOutRunId);

    const result = db.prepare(`
      INSERT INTO task_runs (
        task_id,
        kind,
        status,
        session_key,
        prompt,
        timeout_seconds,
        started_at,
        trigger_source,
        attempt_index,
        repair_of_run_id,
        error_message
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      taskId,
      input.kind,
      input.status,
      input.sessionKey,
      input.prompt,
      input.timeoutSeconds,
      startedAt,
      input.triggerSource,
      input.attemptIndex,
      timedOutRunId,
      input.errorMessage || null,
    );

    db.prepare(`
      UPDATE tasks
      SET active_run_id = ?,
          dispatch_started_at = ?,
          dispatch_timeout_seconds = ?,
          dispatch_status = ?,
          session_key = ?,
          repair_count = repair_count + 1,
          last_dispatch_error = NULL,
          updated_at = ?
      WHERE id = ?
    `).run(
      result.lastInsertRowid,
      startedAt,
      input.timeoutSeconds,
      snapshotStatus,
      input.sessionKey,
      startedAt,
      taskId,
    );

    return result.lastInsertRowid;
  })();

  return getTaskRun(runId);
}

export function completeTaskRun(runId) {
  const db = getDb();
  const finishedAt = now();
  const run = getTaskRun(runId);
  if (!run) {
    throw new Error(`Task run not found: ${runId}`);
  }

  db.prepare(`
    UPDATE task_runs
    SET status = ?, finished_at = ?, error_message = NULL
    WHERE id = ?
  `).run('completed', finishedAt, runId);

  db.prepare(`
    UPDATE tasks
    SET active_run_id = NULL,
        dispatch_started_at = NULL,
        dispatch_timeout_seconds = NULL,
        dispatch_status = ?,
        last_dispatch_error = NULL,
        updated_at = ?
    WHERE id = ?
  `).run('completed', finishedAt, run.task_id);

  return getTaskRun(runId);
}

export function failTaskRunDispatch(
  runId,
  message,
  nextTaskStatus = 'todo',
  nextDispatchStatus = 'dispatch_failed',
) {
  const db = getDb();
  const finishedAt = now();
  const run = getTaskRun(runId);
  if (!run) {
    throw new Error(`Task run not found: ${runId}`);
  }

  db.prepare(`
    UPDATE task_runs
    SET status = ?, finished_at = ?, error_message = ?
    WHERE id = ?
  `).run('dispatch_failed', finishedAt, message, runId);

  db.prepare(`
    UPDATE tasks
    SET status = ?,
        active_run_id = NULL,
        dispatch_started_at = NULL,
        dispatch_timeout_seconds = NULL,
        dispatch_status = ?,
        last_dispatch_error = ?,
        updated_at = ?
    WHERE id = ?
  `).run(nextTaskStatus, nextDispatchStatus, message, finishedAt, run.task_id);

  return getTaskRun(runId);
}

export function listTimedOutRunningTasks(referenceTime = Date.now()) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT tasks.*, task_runs.id AS run_id, task_runs.started_at
    FROM tasks
    JOIN task_runs ON task_runs.id = tasks.active_run_id
    WHERE tasks.status = 'in_progress'
      AND task_runs.status = 'running'
  `).all();

  return rows.filter((row) => {
    const elapsedMs = referenceTime - Date.parse(row.started_at);
    return elapsedMs > (row.dispatch_timeout_seconds * 1000);
  });
}

export function markTaskRunTimedOut(runId) {
  const db = getDb();
  const finishedAt = now();
  const run = getTaskRun(runId);
  if (!run) {
    throw new Error(`Task run not found: ${runId}`);
  }

  db.prepare(`
    UPDATE task_runs
    SET status = ?, finished_at = ?
    WHERE id = ?
  `).run('timed_out', finishedAt, runId);

  db.prepare(`
    UPDATE tasks
    SET active_run_id = NULL,
        dispatch_started_at = NULL,
        dispatch_timeout_seconds = NULL,
        dispatch_status = ?,
        last_dispatch_error = ?,
        updated_at = ?
    WHERE id = ?
  `).run('timed_out', 'Timed out before completion', finishedAt, run.task_id);

  return getTaskRun(runId);
}

export function markRepairExhausted(taskId, message = 'Automatic repair limit reached') {
  const db = getDb();
  db.prepare(`
    UPDATE tasks
    SET active_run_id = NULL,
        dispatch_started_at = NULL,
        dispatch_timeout_seconds = NULL,
        dispatch_status = ?,
        last_dispatch_error = ?,
        updated_at = ?
    WHERE id = ?
  `).run('repair_exhausted', message, now(), taskId);
}
