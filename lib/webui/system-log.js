import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getBaseDir } from '../db.js';

const LOG_FILE = 'system.log';
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

function getLogPath() {
  return join(getBaseDir(), LOG_FILE);
}

function ensureParentDir(filePath) {
  mkdirSync(dirname(filePath), { recursive: true });
}

function normalizeValue(value) {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }
  return value;
}

export function writeSystemLog(level, source, message, meta = undefined) {
  const filePath = getLogPath();
  ensureParentDir(filePath);
  const entry = {
    ts: new Date().toISOString(),
    level: String(level || 'info'),
    source: String(source || 'system'),
    message: String(message || ''),
    ...(meta === undefined ? {} : { meta: normalizeValue(meta) }),
  };
  appendFileSync(filePath, `${JSON.stringify(entry)}\n`, {
    encoding: 'utf-8',
    mode: 0o600,
  });
  return entry;
}

export function readSystemLogs(limit = DEFAULT_LIMIT) {
  const filePath = getLogPath();
  if (!existsSync(filePath)) {
    return {
      path: filePath,
      items: [],
    };
  }

  const normalizedLimit = Math.max(1, Math.min(Number(limit) || DEFAULT_LIMIT, MAX_LIMIT));
  const lines = readFileSync(filePath, 'utf-8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const items = lines
    .slice(-normalizedLimit)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return {
          ts: new Date().toISOString(),
          level: 'warn',
          source: 'system-log',
          message: line,
        };
      }
    })
    .reverse();

  return {
    path: filePath,
    items,
  };
}

export function getSystemLogPath() {
  return getLogPath();
}
