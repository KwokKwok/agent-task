import { getDb } from './db.js';

function now() {
  return new Date().toISOString();
}

function normalizeMeta(meta) {
  if (!meta || (typeof meta === 'object' && Object.keys(meta).length === 0)) {
    return null;
  }
  return JSON.stringify(meta);
}

function parseMeta(metaJson) {
  if (!metaJson) return null;
  try {
    return JSON.parse(metaJson);
  } catch {
    return null;
  }
}

export function addFeedback(taskId, { actor, kind, message, meta } = {}) {
  if (!actor || !['human', 'ai'].includes(actor)) {
    throw new Error('Invalid feedback actor');
  }
  if (!kind || !['reject', 'comment', 'update'].includes(kind)) {
    throw new Error('Invalid feedback kind');
  }
  const text = String(message || '').trim();
  if (!text) {
    throw new Error('Feedback message is required');
  }

  const db = getDb();
  const createdAt = now();
  const metaJson = normalizeMeta(meta);

  const info = db.prepare(`
    INSERT INTO task_feedback (task_id, actor, kind, message, meta_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(taskId, actor, kind, text, metaJson, createdAt);

  return {
    id: info.lastInsertRowid,
    task_id: taskId,
    actor,
    kind,
    message: text,
    meta: meta || null,
    created_at: createdAt,
  };
}

export function listFeedback(taskId) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, task_id, actor, kind, message, meta_json, created_at
    FROM task_feedback
    WHERE task_id = ?
    ORDER BY created_at ASC, id ASC
  `).all(taskId);

  return rows.map((row) => ({
    id: row.id,
    task_id: row.task_id,
    actor: row.actor,
    kind: row.kind,
    message: row.message,
    meta: parseMeta(row.meta_json),
    created_at: row.created_at,
  }));
}

function formatFeedbackHeading(item) {
  const actor = item.actor === 'human' ? 'Human' : 'AI';
  const kind = item.kind === 'reject'
    ? 'Reject'
    : item.kind === 'comment'
      ? 'Comment'
      : 'Update';
  return `${item.created_at} ${actor} ${kind}`;
}

function collectCurrent(items) {
  const latestHuman = [...items].reverse().find((item) => item.actor === 'human') || null;
  const latestAi = [...items].reverse().find((item) => item.actor === 'ai') || null;
  return { latestHuman, latestAi };
}

export function renderFeedbackMarkdown(task, items) {
  const { latestHuman, latestAi } = collectCurrent(items);
  const lines = [
    '# Feedback',
    '',
    '## Current',
    `Current Status: ${task.status}`,
    `Last Human Feedback At: ${latestHuman?.created_at || 'N/A'}`,
    `Last AI Update At: ${latestAi?.created_at || 'N/A'}`,
    '',
    '### Current Human Feedback',
    latestHuman?.message || 'No human feedback yet.',
    '',
    '### Latest AI Response',
    latestAi?.message || 'No AI update yet.',
    '',
    '## Timeline',
    '',
  ];

  if (!items.length) {
    lines.push('No feedback yet.');
    return lines.join('\n');
  }

  for (const item of items) {
    lines.push(`### ${formatFeedbackHeading(item)}`);
    lines.push(item.message);
    if (item.meta?.backupPaths?.length) {
      lines.push('');
      lines.push('Backups:');
      for (const backupPath of item.meta.backupPaths) {
        lines.push(`- ${backupPath}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}
