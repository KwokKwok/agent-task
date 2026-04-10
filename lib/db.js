import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

let _baseDir = null;
let _db = null;

const TASK_COLUMN_MIGRATIONS = [
  ['type_id', `ALTER TABLE tasks ADD COLUMN type_id TEXT`],
  ['timeout_seconds', `ALTER TABLE tasks ADD COLUMN timeout_seconds INTEGER NOT NULL DEFAULT 1800`],
  ['active_run_id', `ALTER TABLE tasks ADD COLUMN active_run_id INTEGER`],
  ['dispatch_started_at', `ALTER TABLE tasks ADD COLUMN dispatch_started_at TEXT`],
  ['dispatch_timeout_seconds', `ALTER TABLE tasks ADD COLUMN dispatch_timeout_seconds INTEGER`],
  ['dispatch_status', `ALTER TABLE tasks ADD COLUMN dispatch_status TEXT NOT NULL DEFAULT 'idle'`],
  ['session_key', `ALTER TABLE tasks ADD COLUMN session_key TEXT`],
  ['repair_count', `ALTER TABLE tasks ADD COLUMN repair_count INTEGER NOT NULL DEFAULT 0`],
  ['last_dispatch_error', `ALTER TABLE tasks ADD COLUMN last_dispatch_error TEXT`],
];

function ensureTaskColumns(db) {
  const columns = db.prepare('PRAGMA table_info(tasks)').all().map((row) => row.name);
  for (const [name, sql] of TASK_COLUMN_MIGRATIONS) {
    if (!columns.includes(name)) {
      db.exec(sql);
    }
  }
}

function getOpenClawRoot() {
  return process.env.OPENCLAW_HOME || join(homedir(), '.openclaw');
}

export function getOpenClawHome() {
  return getOpenClawRoot();
}

export function getBaseDirSource() {
  if (process.env.AGENT_TASK_HOME) return 'AGENT_TASK_HOME';
  if (process.env.OPENCLAW_HOME) return 'OPENCLAW_HOME';
  return 'default';
}

export function getBaseDir() {
  if (!_baseDir) {
    _baseDir =
      process.env.AGENT_TASK_HOME ||
      join(getOpenClawRoot(), 'agent-task');
  }
  return _baseDir;
}

export function getDb() {
  if (_db) return _db;

  const baseDir = getBaseDir();
  if (!existsSync(baseDir)) {
    mkdirSync(baseDir, { recursive: true });
  }

  _db = new Database(join(baseDir, 'tasks.db'));
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  _db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      type_id TEXT,
      status TEXT NOT NULL DEFAULT 'todo',
      priority TEXT DEFAULT 'medium',
      workspace_path TEXT,
      timeout_seconds INTEGER NOT NULL DEFAULT 1800,
      active_run_id INTEGER,
      dispatch_started_at TEXT,
      dispatch_timeout_seconds INTEGER,
      dispatch_status TEXT NOT NULL DEFAULT 'idle',
      session_key TEXT,
      repair_count INTEGER NOT NULL DEFAULT 0,
      last_dispatch_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS task_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      message TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    );

    CREATE TABLE IF NOT EXISTS task_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      actor TEXT NOT NULL,
      kind TEXT NOT NULL,
      message TEXT NOT NULL,
      meta_json TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id)
    );

    CREATE TABLE IF NOT EXISTS task_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      status TEXT NOT NULL,
      session_key TEXT NOT NULL,
      prompt TEXT NOT NULL,
      timeout_seconds INTEGER NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      trigger_source TEXT NOT NULL,
      attempt_index INTEGER NOT NULL,
      repair_of_run_id INTEGER,
      error_message TEXT,
      FOREIGN KEY (task_id) REFERENCES tasks(id),
      FOREIGN KEY (repair_of_run_id) REFERENCES task_runs(id)
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_events_task_id ON task_events(task_id);
    CREATE INDEX IF NOT EXISTS idx_feedback_task_id ON task_feedback(task_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_task_runs_task_id ON task_runs(task_id, started_at);
    CREATE INDEX IF NOT EXISTS idx_task_runs_status ON task_runs(status, started_at);
  `);

  ensureTaskColumns(_db);

  return _db;
}

export function resetDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
  _baseDir = null;
}

export function initDb() {
  const baseDir = getBaseDir();
  const dirs = ['tasks', 'archive', 'tmp'];
  for (const dir of dirs) {
    const p = join(baseDir, dir);
    if (!existsSync(p)) {
      mkdirSync(p, { recursive: true });
    }
  }
  getDb();
}
