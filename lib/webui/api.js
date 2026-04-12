import {
  closeSync,
  existsSync,
  readFileSync,
  openSync,
  readSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { extname, join, resolve, sep } from 'node:path';
import {
  commentTask,
  getTask,
  getTaskEvents,
  getTaskFeedback,
  listTasks,
  rejectTask,
  setStatus,
  updateTaskFeedback,
} from '../task.js';
import { readWebuiConfig, setWebuiConfig } from './config-store.js';
import { readSystemLogs } from './system-log.js';
import { backupReports } from '../workspace.js';
import { buildAgentPrompt } from '../prompt.js';
import { getBaseDir, getBaseDirSource } from '../db.js';
import {
  buildChatAgentPrompt,
  buildExecutionReferencePrompt,
  buildPromptPreview,
  buildPromptSections,
  getPromptPreviewData,
} from '../prompt-builders.js';
import { listTaskRuns } from '../task-run.js';
import { readDefaultPromptTemplates } from '../prompt-template-store.js';
import {
  installAgentTaskIntakeSkill,
  removeAgentTaskIntakeSkill,
} from '../openclaw-skill.js';
import { restartGateway, sendAgentMessage } from '../openclaw.js';
import {
  isS3Enabled,
  getPresignedUrl,
  getPublicObjectUrl,
  verifyS3Connection,
  ensureBucketCors,
  ensureBucketStructure,
} from './s3-client.js';
import {
  getAssetsStats,
  rewriteHtmlWithCachedExternalResources,
  scanAllTasks,
} from '../resource-cache.js';
import { ensureFileSyncedToS3 } from './s3-sync.js';

const PACKAGE_VERSION = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf-8'),
).version;

const MAX_PREVIEW_BYTES = 1024 * 1024;
const REPORT_ASSET_TOKEN_TTL_MS = 1000 * 60 * 30;

const PRIORITY_RANK = {
  low: 0,
  medium: 1,
  high: 2,
  urgent: 3,
};

const SORT_ALLOWLIST = new Set(['created_at', 'updated_at', 'priority', 'status']);
const HTML_REPORT_CSP = [
  "default-src 'none'",
  "img-src 'self' data: blob: https: http:",
  "media-src 'self' data: blob: https: http:",
  "style-src 'unsafe-inline' 'self' https: http:",
  "font-src 'self' data: https: http:",
  "script-src 'unsafe-inline' 'unsafe-eval' blob: data: https: http:",
  "connect-src 'none'",
  "worker-src blob: data:",
  "frame-src blob: data: https: http:",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'none'",
  'sandbox allow-scripts',
].join('; ');

const MIME_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.avif': 'image/avif',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogg': 'video/ogg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
  '.txt': 'text/plain; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.pdf': 'application/pdf',
};

function json(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function notFound(res, message = 'Not Found') {
  json(res, 404, { error: message });
}

function badRequest(res, message) {
  json(res, 400, { error: message });
}

function serverError(res, message, details) {
  json(res, 500, {
    error: message,
    ...(details ? { details } : {}),
  });
}

function normalizeBooleanParam(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function getMimeType(filePath) {
  return MIME_TYPES[extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function shouldRedirectAssetToS3(filePath) {
  const ext = extname(filePath).toLowerCase();
  return !new Set([
    '.css',
    '.js',
    '.mjs',
    '.json',
    '.txt',
    '.map',
  ]).has(ext);
}

function getCrossOriginAssetHeaders(filePath) {
  const ext = extname(filePath).toLowerCase();
  const embeddableExts = new Set([
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.webp',
    '.svg',
    '.bmp',
    '.ico',
    '.avif',
    '.woff',
    '.woff2',
    '.ttf',
    '.otf',
    '.eot',
    '.mp4',
    '.webm',
    '.ogg',
    '.mp3',
    '.wav',
    '.m4a',
    '.aac',
    '.flac',
  ]);
  const fontExts = new Set(['.woff', '.woff2', '.ttf', '.otf', '.eot']);

  if (!embeddableExts.has(ext)) {
    return {};
  }

  const headers = {
    'Cross-Origin-Resource-Policy': 'cross-origin',
  };

  if (fontExts.has(ext)) {
    headers['Access-Control-Allow-Origin'] = '*';
  }

  return headers;
}

function signValue(value, secret) {
  return createHmac('sha256', secret).update(value).digest('hex');
}

function safeEqualString(a, b) {
  const aBuf = Buffer.from(String(a || ''));
  const bBuf = Buffer.from(String(b || ''));
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function createReportAssetToken(taskId, secret) {
  if (!secret) return '';
  const payload = Buffer.from(JSON.stringify({
    taskId,
    exp: Date.now() + REPORT_ASSET_TOKEN_TTL_MS,
  }), 'utf-8').toString('base64url');
  return `${payload}.${signValue(payload, secret)}`;
}

function validateReportAssetToken(rawToken, taskId, secret) {
  if (!rawToken || !secret) return false;
  const dotIndex = String(rawToken).lastIndexOf('.');
  if (dotIndex <= 0) return false;

  const payload = String(rawToken).slice(0, dotIndex);
  const sig = String(rawToken).slice(dotIndex + 1);
  if (!safeEqualString(sig, signValue(payload, secret))) return false;

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    return parsed?.taskId === taskId && Number(parsed?.exp) > Date.now();
  } catch {
    return false;
  }
}

function normalizeReportAssetPath(rawPath) {
  const value = String(rawPath || '').trim().replace(/\\/g, '/');
  if (!value) return '';

  const parts = value.split(/([?#].*)/, 2);
  const pathPart = parts[0] || '';
  const suffix = value.slice(pathPart.length);
  const normalizedSegments = pathPart
    .split('/')
    .filter(Boolean)
    .filter((segment) => segment !== '.');

  while (normalizedSegments[0] === '..') {
    normalizedSegments.shift();
  }

  return `${normalizedSegments.join('/')}${suffix}`;
}

function isExternalAssetReference(url) {
  const value = String(url || '').trim();
  if (!value) return true;
  if (value.startsWith('#')) return true;
  if (value.startsWith('/')) return true;
  return /^(data|blob|https?|mailto|tel|javascript):/i.test(value);
}

function buildReportAssetUrl(taskId, assetToken, rawPath) {
  const normalized = normalizeReportAssetPath(rawPath);
  if (!normalized) return rawPath;

  const [pathname, suffix = ''] = normalized.split(/([?#].*)/, 2);
  const encodedPath = pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  const basePath = assetToken
    ? `/api/tasks/${taskId}/asset-token/${assetToken}/`
    : `/api/tasks/${taskId}/asset/`;
  return `${basePath}${encodedPath}${suffix}`;
}

function rewriteReportAssetUrls(html, taskId, assetToken) {
  const replaceAttr = (source, attr) => source.replace(
    new RegExp(`(${attr}\\s*=\\s*["'])([^"']+)(["'])`, 'gi'),
    (_, prefix, value, suffix) => {
      if (isExternalAssetReference(value)) {
        return `${prefix}${value}${suffix}`;
      }
      return `${prefix}${buildReportAssetUrl(taskId, assetToken, value)}${suffix}`;
    },
  );

  const replaceSrcset = (source) => source.replace(
    /(srcset\s*=\s*["'])([^"']+)(["'])/gi,
    (_, prefix, value, suffix) => {
      const rewritten = String(value)
        .split(',')
        .map((candidate) => {
          const trimmed = candidate.trim();
          if (!trimmed) return trimmed;
          const [url, descriptor] = trimmed.split(/\s+/, 2);
          if (isExternalAssetReference(url)) return trimmed;
          const rewrittenUrl = buildReportAssetUrl(taskId, assetToken, url);
          return descriptor ? `${rewrittenUrl} ${descriptor}` : rewrittenUrl;
        })
        .join(', ');
      return `${prefix}${rewritten}${suffix}`;
    },
  );

  const replaceCssUrls = (source) => source.replace(
    /url\((["']?)([^"')]+)\1\)/gi,
    (match, quote, value) => {
      if (isExternalAssetReference(value)) {
        return match;
      }
      const rewritten = buildReportAssetUrl(taskId, assetToken, value);
      return `url(${quote}${rewritten}${quote})`;
    },
  );

  let output = html;
  output = replaceAttr(output, 'src');
  output = replaceAttr(output, 'href');
  output = replaceAttr(output, 'poster');
  output = replaceSrcset(output);
  output = replaceCssUrls(output);
  return output;
}

function injectHtmlBase(html, taskId, assetToken) {
  const baseHref = assetToken
    ? `/api/tasks/${taskId}/asset-token/${assetToken}/`
    : `/api/tasks/${taskId}/asset/`;
  const inject = `<base href="${baseHref}"><link rel="icon" type="image/svg+xml" href="/static/assets/logo-K4dwUfs6.svg">`;
  const rewrittenHtml = rewriteReportAssetUrls(html, taskId, assetToken);
  if (/<head[^>]*>/i.test(rewrittenHtml)) {
    // Inject after existing <base> if present, otherwise after <head>
    if (/<base\s/i.test(rewrittenHtml)) return rewrittenHtml;
    return rewrittenHtml.replace(/<head([^>]*)>/i, `<head$1>${inject}`);
  }
  return `${inject}${rewrittenHtml}`;
}

function resolveIncomingS3Config(rawS3) {
  if (!rawS3 || typeof rawS3 !== 'object') return undefined;
  const current = readWebuiConfig();
  const next = { ...rawS3 };
  if (next.secretAccessKey === '********') {
    next.secretAccessKey = current.s3?.secretAccessKey || '';
  }
  return next;
}

function toSummary(task) {
  let hasReportAudio = false;
  if (task.workspace_path && existsSync(task.workspace_path)) {
    try {
      const files = readdirSync(task.workspace_path);
      hasReportAudio = files.some((file) => file.toLowerCase() === 'report.mp3');
    } catch {
      // Ignore workspace listing failures in summary mode.
    }
  }

  return {
    id: task.id,
    title: task.title,
    description: task.description,
    type_id: task.type_id,
    status: task.status,
    priority: task.priority,
    timeout_seconds: task.timeout_seconds,
    dispatch_status: task.dispatch_status,
    dispatch_started_at: task.dispatch_started_at,
    dispatch_timeout_seconds: task.dispatch_timeout_seconds,
    session_key: task.session_key,
    repair_count: task.repair_count,
    last_dispatch_error: task.last_dispatch_error,
    created_at: task.created_at,
    updated_at: task.updated_at,
    workspace_path: task.workspace_path,
    has_audio: hasReportAudio,
    has_report_audio: hasReportAudio,
  };
}

function compareValues(a, b, field) {
  if (field === 'priority') {
    return (PRIORITY_RANK[a.priority] ?? -1) - (PRIORITY_RANK[b.priority] ?? -1);
  }
  return String(a[field] ?? '').localeCompare(String(b[field] ?? ''));
}

function normalizeOrder(value) {
  return String(value || 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';
}

function normalizeSortBy(value) {
  const v = String(value || 'created_at');
  return SORT_ALLOWLIST.has(v) ? v : 'created_at';
}

function getWorkspaceRoot(task) {
  if (!task?.workspace_path) return null;
  if (!existsSync(task.workspace_path)) return null;
  return task.workspace_path;
}

function resolveSafePath(root, subPath = '') {
  const normalized = String(subPath || '').replace(/\\/g, '/');
  const target = resolve(join(root, normalized));
  const rootResolved = resolve(root);

  if (target !== rootResolved && !target.startsWith(rootResolved + sep)) {
    throw new Error('Path escapes workspace root');
  }

  return target;
}

function resolveWorkspaceReadPath(root, subPath = '') {
  const normalized = String(subPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  const directPath = resolveSafePath(root, normalized);
  if (existsSync(directPath)) {
    return directPath;
  }

  if (!normalized || normalized.startsWith('work/')) {
    return directPath;
  }

  const workFallbackPath = resolveSafePath(root, `work/${normalized}`);
  if (existsSync(workFallbackPath)) {
    return workFallbackPath;
  }

  return directPath;
}

function detectBinary(buffer) {
  const sample = buffer.subarray(0, Math.min(buffer.length, 1024));
  for (let i = 0; i < sample.length; i += 1) {
    if (sample[i] === 0) return true;
  }
  return false;
}

function getAudioType(filePath) {
  const ext = extname(filePath).toLowerCase();
  const audioExt = new Set(['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac', '.webm']);
  return audioExt.has(ext) ? ext.slice(1) : null;
}

function getImageType(filePath) {
  const ext = extname(filePath).toLowerCase();
  const imageExt = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico', '.avif']);
  return imageExt.has(ext) ? ext.slice(1) : null;
}

function canInlinePreview(filePath) {
  const ext = extname(filePath).toLowerCase();
  const textExt = new Set([
    '.txt', '.md', '.markdown', '.json', '.js', '.ts', '.tsx', '.jsx', '.css', '.html',
    '.sh', '.yml', '.yaml', '.toml', '.ini', '.xml', '.log', '.csv', '.sql',
  ]);
  return textExt.has(ext) || ext === '';
}

function buildFileList(taskId, root, currentPath) {
  const abs = resolveSafePath(root, currentPath);
  const stat = statSync(abs);
  if (!stat.isDirectory()) {
    throw new Error('Path is not a directory');
  }

  const items = readdirSync(abs, { withFileTypes: true })
    .map((entry) => {
      const childRelative = currentPath ? `${currentPath}/${entry.name}` : entry.name;
      const childAbs = resolveSafePath(root, childRelative);
      const childStat = statSync(childAbs);
      return {
        taskId,
        name: entry.name,
        path: childRelative,
        type: entry.isDirectory() ? 'dir' : 'file',
        size: childStat.size,
        mtime: childStat.mtime.toISOString(),
      };
    })
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  return {
    path: currentPath || '',
    items,
  };
}

function readFilePreview(root, filePath) {
  const abs = resolveWorkspaceReadPath(root, filePath);
  const stat = statSync(abs);
  if (!stat.isFile()) {
    throw new Error('Path is not a file');
  }

  const audioType = getAudioType(abs);
  if (audioType) {
    return {
      path: filePath,
      type: 'audio',
      audioType,
      size: stat.size,
      mtime: stat.mtime.toISOString(),
    };
  }

  const imageType = getImageType(abs);
  if (imageType) {
    return {
      path: filePath,
      type: 'image',
      imageType,
      mimeType: getMimeType(abs),
      size: stat.size,
      mtime: stat.mtime.toISOString(),
    };
  }

  const bytes = Math.min(stat.size, MAX_PREVIEW_BYTES + 1);
  const data = Buffer.alloc(bytes);
  const fd = openSync(abs, 'r');
  let bytesRead = 0;
  try {
    bytesRead = readSync(fd, data, 0, bytes, 0);
  } finally {
    closeSync(fd);
  }

  const sample = data.subarray(0, bytesRead);
  if (detectBinary(sample) || !canInlinePreview(abs)) {
    return {
      path: filePath,
      type: 'binary',
      size: stat.size,
      mtime: stat.mtime.toISOString(),
      message: 'Binary or unsupported file type. Open directly if needed.',
    };
  }

  const truncated = stat.size > MAX_PREVIEW_BYTES;
  const preview = sample.subarray(0, Math.min(bytesRead, MAX_PREVIEW_BYTES)).toString('utf-8');

  return {
    path: filePath,
    type: 'text',
    size: stat.size,
    mtime: stat.mtime.toISOString(),
    truncated,
    content: preview,
  };
}

function getTaskWithFlags(id) {
  const task = getTask(id);
  if (!task) return null;
  const root = getWorkspaceRoot(task);
  return {
    ...toSummary(task),
    hasReportHtml: !!(root && existsSync(join(root, 'report.html'))),
    hasReportMd: !!(root && existsSync(join(root, 'report.md'))),
    hasReportAudio: !!(root && existsSync(join(root, 'report.mp3'))),
  };
}

function hasTaskLogReference(logItem, { taskId, sessionKeys, runIds }) {
  const meta = logItem?.meta && typeof logItem.meta === 'object' ? logItem.meta : null;

  if (String(meta?.taskId || '') === taskId) return true;
  if (meta?.sessionKey && sessionKeys.has(String(meta.sessionKey))) return true;
  if (meta?.runId != null && runIds.has(Number(meta.runId))) return true;
  if (meta?.repairOfRunId != null && runIds.has(Number(meta.repairOfRunId))) return true;

  const haystack = `${logItem?.message || ''}\n${JSON.stringify(meta || {})}`;
  return haystack.includes(taskId);
}

function buildTaskDebugPayload(task, { logLimit } = {}) {
  const summary = getTaskWithFlags(task.id);
  const runs = listTaskRuns(task.id);
  const sessionKeys = new Set(
    [task.session_key, ...runs.map((run) => run.session_key)]
      .map((item) => String(item || '').trim())
      .filter(Boolean),
  );
  const runIds = new Set(runs.map((run) => Number(run.id)).filter(Number.isFinite));
  const logs = readSystemLogs(logLimit).items.filter((item) => hasTaskLogReference(item, {
    taskId: task.id,
    sessionKeys,
    runIds,
  }));

  return {
    summary,
    runs,
    logs,
  };
}

function ok(res, data = { success: true }) {
  json(res, 200, data);
}

export async function handleApiRequest(req, res, pathname, searchParams, body = { json: null }, runtime = {}) {
  if (pathname === '/api/internal/runtime' && req.method === 'GET') {
    if (!runtime.runtimeInfo) {
      return badRequest(res, 'Runtime unavailable'), true;
    }
    ok(res, runtime.runtimeInfo);
    return true;
  }

  if (pathname === '/api/internal/dispatch/run' && req.method === 'POST') {
    if (!runtime.scheduler) {
      return badRequest(res, 'Scheduler unavailable'), true;
    }
    await runtime.scheduler.runCycle(body.json?.triggerSource || 'task_created');
    ok(res, { ok: true });
    return true;
  }

  if (pathname === '/api/tasks' && req.method === 'GET') {
    const status = searchParams.get('status');
    const sortBy = normalizeSortBy(searchParams.get('sortBy'));
    const order = normalizeOrder(searchParams.get('order'));

    let tasks = listTasks({ all: status === 'all' });
    if (status && status !== 'all') {
      tasks = tasks.filter((item) => item.status === status);
    }

    tasks.sort((a, b) => compareValues(a, b, sortBy));
    if (order === 'desc') {
      tasks.reverse();
    }

    ok(res, {
      items: tasks.map(toSummary),
      total: tasks.length,
      sortBy,
      order,
      status: status || 'all',
    });
    return true;
  }

  const matchTask = pathname.match(/^\/api\/tasks\/([a-z0-9-]+)$/);
  if (matchTask && req.method === 'GET') {
    const item = getTaskWithFlags(matchTask[1]);
    if (!item) return notFound(res, 'Task not found'), true;
    ok(res, item);
    return true;
  }

  const matchStatus = pathname.match(/^\/api\/tasks\/([a-z0-9-]+)\/status$/);
  if (matchStatus && req.method === 'PATCH') {
    const payload = body.json;
    if (!payload?.status) return badRequest(res, 'Missing status'), true;
    try {
      const task = setStatus(matchStatus[1], payload.status, payload.message);
      ok(res, getTaskWithFlags(task.id));
    } catch (error) {
      badRequest(res, error.message);
    }
    return true;
  }

  const matchEvents = pathname.match(/^\/api\/tasks\/([a-z0-9-]+)\/events$/);
  if (matchEvents && req.method === 'GET') {
    const task = getTask(matchEvents[1]);
    if (!task) return notFound(res, 'Task not found'), true;
    ok(res, { items: getTaskEvents(task.id) });
    return true;
  }

  const matchFeedback = pathname.match(/^\/api\/tasks\/([a-z0-9-]+)\/feedback$/);
  if (matchFeedback && req.method === 'GET') {
    try {
      const data = getTaskFeedback(matchFeedback[1]);
      ok(res, data);
    } catch (error) {
      notFound(res, error.message);
    }
    return true;
  }

  const matchReject = pathname.match(/^\/api\/tasks\/([a-z0-9-]+)\/feedback\/reject$/);
  if (matchReject && req.method === 'POST') {
    try {
      const item = rejectTask(matchReject[1], body.json?.message);
      if (runtime.scheduler) {
        await runtime.scheduler.runCycle('feedback_reject');
      }
      ok(res, item);
    } catch (error) {
      badRequest(res, error.message);
    }
    return true;
  }

  const matchComment = pathname.match(/^\/api\/tasks\/([a-z0-9-]+)\/feedback\/comment$/);
  if (matchComment && req.method === 'POST') {
    try {
      const item = commentTask(matchComment[1], body.json?.message);
      ok(res, item);
    } catch (error) {
      badRequest(res, error.message);
    }
    return true;
  }

  const matchUpdate = pathname.match(/^\/api\/tasks\/([a-z0-9-]+)\/feedback\/update$/);
  if (matchUpdate && req.method === 'POST') {
    try {
      const task = getTask(matchUpdate[1]);
      if (!task) return notFound(res, 'Task not found'), true;
      const backupPaths = body.json?.backup ? backupReports(task.workspace_path) : [];
      const item = updateTaskFeedback(matchUpdate[1], body.json?.message, backupPaths.length ? { backupPaths } : null);
      ok(res, item);
    } catch (error) {
      badRequest(res, error.message);
    }
    return true;
  }

  const matchReport = pathname.match(/^\/api\/tasks\/([a-z0-9-]+)\/report$/);
  if (matchReport && req.method === 'GET') {
    const task = getTask(matchReport[1]);
    if (!task) return notFound(res, 'Task not found'), true;
    const root = getWorkspaceRoot(task);
    if (!root) return badRequest(res, 'Workspace not available'), true;
    const reportPath = join(root, 'report.md');
    if (!existsSync(reportPath)) return notFound(res, 'report.md not found'), true;
    ok(res, { content: readFileSync(reportPath, 'utf-8') });
    return true;
  }

  const matchDebug = pathname.match(/^\/api\/tasks\/([a-z0-9-]+)\/debug$/);
  if (matchDebug && req.method === 'GET') {
    const task = getTask(matchDebug[1]);
    if (!task) return notFound(res, 'Task not found'), true;
    ok(res, buildTaskDebugPayload(task, {
      logLimit: searchParams.get('logLimit'),
    }));
    return true;
  }

  const matchFiles = pathname.match(/^\/api\/tasks\/([a-z0-9-]+)\/files$/);
  if (matchFiles && req.method === 'GET') {
    const task = getTask(matchFiles[1]);
    if (!task) return notFound(res, 'Task not found'), true;
    const root = getWorkspaceRoot(task);
    if (!root) return badRequest(res, 'Workspace not available'), true;
    try {
      ok(res, buildFileList(task.id, root, searchParams.get('path') || ''));
    } catch (error) {
      badRequest(res, error.message);
    }
    return true;
  }

  const matchFile = pathname.match(/^\/api\/tasks\/([a-z0-9-]+)\/file$/);
  if (matchFile && req.method === 'GET') {
    const task = getTask(matchFile[1]);
    if (!task) return notFound(res, 'Task not found'), true;
    const root = getWorkspaceRoot(task);
    if (!root) return badRequest(res, 'Workspace not available'), true;
    const filePath = searchParams.get('path');
    if (!filePath) return badRequest(res, 'Missing file path'), true;

    try {
      const absPath = resolveWorkspaceReadPath(root, filePath);
      const audioType = getAudioType(absPath);
      if (audioType && searchParams.get('meta') === 'true') {
        const stat = statSync(absPath);
        ok(res, {
          path: filePath,
          type: 'audio',
          audioType,
          size: stat.size,
          mtime: stat.mtime.toISOString(),
        });
        return true;
      }
      const imageType = getImageType(absPath);
      if (imageType && searchParams.get('meta') === 'true') {
        const stat = statSync(absPath);
        ok(res, {
          path: filePath,
          type: 'image',
          imageType,
          mimeType: getMimeType(absPath),
          size: stat.size,
          mtime: stat.mtime.toISOString(),
        });
        return true;
      }
      if (audioType) {
        const audioContent = readFileSync(absPath);
        const mimeTypes = {
          mp3: 'audio/mpeg',
          wav: 'audio/wav',
          m4a: 'audio/mp4',
          ogg: 'audio/ogg',
          flac: 'audio/flac',
          aac: 'audio/aac',
          webm: 'audio/webm',
        };
        res.writeHead(200, {
          'Content-Type': mimeTypes[audioType] || 'audio/mpeg',
          'Content-Length': audioContent.length,
        });
        res.end(audioContent);
        return true;
      }
      ok(res, readFilePreview(root, filePath));
    } catch (error) {
      badRequest(res, error.message);
    }
    return true;
  }

  const matchAsset = pathname.match(/^\/api\/tasks\/([a-z0-9-]+)\/asset\/(.+)$/);
  if (matchAsset && req.method === 'GET') {
    const task = getTask(matchAsset[1]);
    if (!task) return notFound(res, 'Task not found'), true;
    const filePath = decodeURIComponent(matchAsset[2] || '');
    if (!filePath) return badRequest(res, 'Missing file path'), true;

    const root = getWorkspaceRoot(task);
    if (!root) return badRequest(res, 'Workspace not available'), true;

    try {
      const absPath = resolveWorkspaceReadPath(root, filePath);
      const stat = statSync(absPath);
      if (!stat.isFile()) return badRequest(res, 'Path is not a file'), true;

      // S3: ensure synced, then redirect to a short-lived signed URL
      if (isS3Enabled() && shouldRedirectAssetToS3(absPath)) {
        const s3Key = `tasks/${task.id}/${filePath}`;
        const synced = await ensureFileSyncedToS3(s3Key, absPath);
        if (synced) {
          const signedUrl = await getPresignedUrl(s3Key);
          if (signedUrl) {
            res.writeHead(302, {
              Location: signedUrl,
              'Cache-Control': 'no-store',
              ...getCrossOriginAssetHeaders(absPath),
            });
            res.end();
            return true;
          }
        }
      }

      // Fallback: serve local file
      const etag = `"${stat.size}-${stat.mtimeMs.toFixed(0)}"`;
      if (req.headers['if-none-match'] === etag) {
        res.writeHead(304, getCrossOriginAssetHeaders(absPath));
        res.end();
        return true;
      }
      const content = readFileSync(absPath);
      res.writeHead(200, {
        'Content-Type': getMimeType(absPath),
        'Content-Length': content.length,
        'Cache-Control': 'private, max-age=1209600',
        'ETag': etag,
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': 'inline',
        ...getCrossOriginAssetHeaders(absPath),
      });
      res.end(content);
    } catch (error) {
      badRequest(res, error.message);
    }
    return true;
  }

  const matchAssetToken = pathname.match(/^\/api\/tasks\/([a-z0-9-]+)\/asset-token\/([^/]+)\/(.+)$/);
  if (matchAssetToken && req.method === 'GET') {
    const task = getTask(matchAssetToken[1]);
    if (!task) return notFound(res, 'Task not found'), true;
    if (!validateReportAssetToken(matchAssetToken[2], task.id, runtime.authToken)) {
      res.writeHead(401, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Unauthorized');
      return true;
    }
    const filePath = decodeURIComponent(matchAssetToken[3] || '');
    if (!filePath) return badRequest(res, 'Missing file path'), true;

    const root = getWorkspaceRoot(task);
    if (!root) return badRequest(res, 'Workspace not available'), true;

    try {
      const absPath = resolveWorkspaceReadPath(root, filePath);
      const stat = statSync(absPath);
      if (!stat.isFile()) return badRequest(res, 'Path is not a file'), true;

      // S3: ensure synced, then redirect to a short-lived signed URL
      if (isS3Enabled() && shouldRedirectAssetToS3(absPath)) {
        const s3Key = `tasks/${task.id}/${filePath}`;
        const synced = await ensureFileSyncedToS3(s3Key, absPath);
        if (synced) {
          const signedUrl = await getPresignedUrl(s3Key);
          if (signedUrl) {
            res.writeHead(302, {
              Location: signedUrl,
              'Cache-Control': 'no-store',
              ...getCrossOriginAssetHeaders(absPath),
            });
            res.end();
            return true;
          }
        }
      }

      // Fallback: serve local file
      const etag = `"${stat.size}-${stat.mtimeMs.toFixed(0)}"`;
      if (req.headers['if-none-match'] === etag) {
        res.writeHead(304, getCrossOriginAssetHeaders(absPath));
        res.end();
        return true;
      }
      const content = readFileSync(absPath);
      res.writeHead(200, {
        'Content-Type': getMimeType(absPath),
        'Content-Length': content.length,
        'Cache-Control': 'private, max-age=1209600',
        'ETag': etag,
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': 'inline',
        ...getCrossOriginAssetHeaders(absPath),
      });
      res.end(content);
    } catch (error) {
      badRequest(res, error.message);
    }
    return true;
  }

  const matchOpenReport = pathname.match(/^\/api\/tasks\/([a-z0-9-]+)\/open-report$/);
  if (matchOpenReport && req.method === 'GET') {
    const task = getTask(matchOpenReport[1]);
    if (!task) return notFound(res, 'Task not found'), true;
    const root = getWorkspaceRoot(task);
    if (!root) return badRequest(res, 'Workspace not available'), true;
    const reportPath = join(root, 'report.html');
    if (!existsSync(reportPath)) return notFound(res, 'report.html not found'), true;
    const config = readWebuiConfig();
    let html = readFileSync(reportPath, 'utf-8');
    if (config.resourceCache?.enabled !== false) {
      html = rewriteHtmlWithCachedExternalResources(html);
    }
    html = injectHtmlBase(
      html,
      task.id,
      createReportAssetToken(task.id, runtime.authToken),
    );
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': HTML_REPORT_CSP,
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
    });
    res.end(html);
    return true;
  }

  // Cached asset files (no auth required — public resources)
  const matchCachedAsset = pathname.match(/^\/api\/assets\/([a-f0-9]+\.[a-zA-Z0-9]+)$/);
  if (matchCachedAsset && req.method === 'GET') {
    const { getAssetsDir } = await import('../resource-cache.js');
    const assetsDir = getAssetsDir();
    const absPath = resolveSafePath(assetsDir, matchCachedAsset[1]);
    if (!existsSync(absPath)) return notFound(res, 'Asset not found'), true;
    const stat = statSync(absPath);
    if (!stat.isFile()) return notFound(res, 'Asset not found'), true;

    // S3: cached assets are public immutable resources, so redirect to the public object URL
    if (isS3Enabled() && shouldRedirectAssetToS3(absPath)) {
      const s3Key = `assets/${matchCachedAsset[1]}`;
      const synced = await ensureFileSyncedToS3(s3Key, absPath);
      if (synced) {
        const publicUrl = await getPublicObjectUrl(s3Key);
        if (publicUrl) {
          res.writeHead(302, {
            Location: publicUrl,
            'Cache-Control': 'no-store',
            ...getCrossOriginAssetHeaders(absPath),
          });
          res.end();
          return true;
        }
      }
    }

    // Fallback: serve local file
    const etag = `"${stat.size}-${stat.mtimeMs.toFixed(0)}"`;
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, getCrossOriginAssetHeaders(absPath));
      res.end();
      return true;
    }
    const content = readFileSync(absPath);
    res.writeHead(200, {
      'Content-Type': getMimeType(absPath),
      'Content-Length': content.length,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'ETag': etag,
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline',
      ...getCrossOriginAssetHeaders(absPath),
    });
    res.end(content);
    return true;
  }

  // Storage stats
  if (pathname === '/api/storage/stats' && req.method === 'GET') {
    const stats = getAssetsStats();
    const config = readWebuiConfig();
    ok(res, {
      assetsCount: stats.count,
      assetsSize: stats.totalSize,
      dataRoot: getBaseDir(),
      s3Enabled: isS3Enabled(),
      resourceCacheEnabled: config.resourceCache?.enabled !== false,
    });
    return true;
  }

  // Scan all tasks for resources
  if (pathname === '/api/storage/scan-resources' && req.method === 'POST') {
    try {
      const config = readWebuiConfig();
      if (config.resourceCache?.enabled === false) {
        ok(res, {
          scanned: 0,
          cached: 0,
          errors: 0,
          disabled: true,
        });
        return true;
      }
      const result = await scanAllTasks();
      ok(res, result);
    } catch (error) {
      serverError(res, error.message);
    }
    return true;
  }

  // S3 verify connection
  if (pathname === '/api/s3/verify' && req.method === 'POST') {
    try {
      const s3Input = resolveIncomingS3Config(body.json?.s3);
      const result = await verifyS3Connection(s3Input);
      ok(res, result);
    } catch (error) {
      serverError(res, error.message);
    }
    return true;
  }

  if (pathname === '/api/s3/enable' && req.method === 'POST') {
    try {
      const s3Input = resolveIncomingS3Config(body.json?.s3);
      const verifyResult = await verifyS3Connection(s3Input);
      if (!verifyResult.ok) {
        badRequest(res, verifyResult.error || 'S3 连接失败');
        return true;
      }
      await ensureBucketCors(s3Input);
      await ensureBucketStructure(s3Input);
      ok(res, { ok: true });
    } catch (error) {
      serverError(res, error.message);
    }
    return true;
  }

  if (pathname === '/api/config' && req.method === 'GET') {
    const config = readWebuiConfig();
    ok(res, {
      host: config.host || '',
      port: config.port || 3333,
      publicUrl: config.publicUrl || '',
      dataRoot: getBaseDir(),
      dataRootSource: getBaseDirSource(),
      version: PACKAGE_VERSION,
      runtimeInfo: runtime.runtimeInfo || null,
      general: config.general,
      executionGuidance: config.executionGuidance,
      chatGuidance: config.chatGuidance,
      resourceCache: config.resourceCache,
      s3: {
        ...config.s3,
        secretAccessKey: config.s3?.secretAccessKey ? '********' : '',
      },
    });
    return true;
  }

  if (pathname === '/api/config' && req.method === 'PUT') {
    const d = body.json;
    if (!d) return badRequest(res, 'Invalid JSON body'), true;
    try {
      const current = readWebuiConfig();
      const s3Input = d.s3 && typeof d.s3 === 'object' ? { ...d.s3 } : undefined;
      // Preserve secret when mask string sent back
      if (s3Input && s3Input.secretAccessKey === '********') {
        s3Input.secretAccessKey = current.s3?.secretAccessKey || '';
      }
      const updated = setWebuiConfig({
        host: d.host,
        port: d.port,
        publicUrl: d.publicUrl,
        general: d.general,
        executionGuidance: d.executionGuidance,
        chatGuidance: d.chatGuidance,
        resourceCache: d.resourceCache,
        ...(s3Input !== undefined ? { s3: s3Input } : {}),
      });
      ok(res, {
        host: updated.host || '',
        port: updated.port || 3333,
        publicUrl: updated.publicUrl || '',
        dataRoot: getBaseDir(),
        dataRootSource: getBaseDirSource(),
        version: PACKAGE_VERSION,
        runtimeInfo: runtime.runtimeInfo || null,
        general: updated.general,
        executionGuidance: updated.executionGuidance,
        chatGuidance: updated.chatGuidance,
        resourceCache: updated.resourceCache,
        s3: {
          ...updated.s3,
          secretAccessKey: updated.s3?.secretAccessKey ? '********' : '',
        },
      });
    } catch (error) {
      badRequest(res, error.message);
    }
    return true;
  }

  if (pathname === '/api/prompts/chat' && req.method === 'GET') {
    const config = readWebuiConfig();
    ok(res, {
      content: buildChatAgentPrompt({
        config,
        dataRoot: getBaseDir(),
      }),
    });
    return true;
  }

  if (pathname === '/api/prompts/defaults' && req.method === 'GET') {
    const defaults = readDefaultPromptTemplates();
    const type = searchParams.get('type');

    if (type === 'chat' || type === 'execution') {
      ok(res, {
        type,
        content: defaults[type],
      });
      return true;
    }

    ok(res, defaults);
    return true;
  }

  if (pathname === '/api/prompts/execution' && req.method === 'GET') {
    const config = readWebuiConfig();
    const mode = searchParams.get('mode') === 'repair' ? 'repair' : 'dispatch';
    const hasFeedback = normalizeBooleanParam(searchParams.get('hasFeedback'));
    ok(res, {
      content: buildExecutionReferencePrompt({
        config,
        dataRoot: getBaseDir(),
        mode,
        hasFeedback,
      }),
    });
    return true;
  }

  if (pathname === '/api/prompt' && req.method === 'GET') {
    ok(res, {
      content: buildAgentPrompt(),
    });
    return true;
  }

  if (pathname === '/api/prompts/sections' && req.method === 'GET') {
    const config = readWebuiConfig();
    const type = searchParams.get('type') === 'chat' ? 'chat' : 'execution';
    const mode = searchParams.get('mode') === 'repair' ? 'repair' : 'dispatch';
    const taskId = searchParams.get('taskId') || null;
    const useMockTask = normalizeBooleanParam(searchParams.get('useMockTask'), !taskId);
    const hasFeedback = normalizeBooleanParam(searchParams.get('hasFeedback'));

    let task = null;
    let feedback = null;
    if (taskId && !useMockTask && type === 'execution') {
      task = getTask(taskId);
      if (!task) return notFound(res, 'Task not found'), true;
      try { feedback = getTaskFeedback(taskId); } catch { /* no feedback */ }
    }

    const previewData = getPromptPreviewData({
      dataRoot: getBaseDir(),
      task,
      feedback,
      useMockTask,
      hasFeedback,
    });

    try {
      const result = buildPromptSections({
        type,
        config,
        dataRoot: getBaseDir(),
        task: previewData.task,
        mode,
        feedback: previewData.feedback,
        hasFeedback,
      });
      ok(res, result);
    } catch (error) {
      badRequest(res, error.message);
    }
    return true;
  }

  if (pathname === '/api/prompts/preview' && (req.method === 'GET' || req.method === 'POST')) {
    const payload = req.method === 'POST' ? (body.json || {}) : {};
    const type = (payload.type || searchParams.get('type')) === 'chat' ? 'chat' : 'execution';
    const taskId = payload.taskId ?? searchParams.get('taskId');
    const useMockTask = normalizeBooleanParam(
      payload.useMockTask ?? searchParams.get('useMockTask'),
      !taskId,
    );
    const mode = (payload.mode || searchParams.get('mode')) === 'repair' ? 'repair' : 'dispatch';
    const hasFeedback = normalizeBooleanParam(
      payload.hasFeedback ?? searchParams.get('hasFeedback'),
      false,
    );
    const config = payload.config || readWebuiConfig();

    let task = null;
    let feedback = null;
    if (taskId && !useMockTask) {
      task = getTask(taskId);
      if (!task) return notFound(res, 'Task not found'), true;
      try { feedback = getTaskFeedback(taskId); } catch { /* no feedback */ }
    }

    try {
      const previewData = getPromptPreviewData({
        dataRoot: getBaseDir(),
        task,
        feedback,
        useMockTask,
        hasFeedback,
      });
      ok(res, {
        content: buildPromptPreview({
          type,
          config,
          dataRoot: getBaseDir(),
          task: previewData.task,
          mode,
          feedback: previewData.feedback,
          hasFeedback,
        }),
      });
    } catch (error) {
      badRequest(res, error.message);
    }
    return true;
  }

  if (pathname === '/api/openclaw/agent/message' && req.method === 'POST') {
    const sessionId = String(body.json?.sessionId ?? '').trim();
    const agentId = String(body.json?.agentId ?? 'main').trim() || 'main';
    const message = String(body.json?.message ?? '').trim();
    const thinking = String(body.json?.thinking ?? 'off').trim() || 'off';
    const timeoutSeconds = Number(body.json?.timeoutSeconds ?? 1800);

    if (!message) return badRequest(res, 'message is required'), true;
    if (!Number.isInteger(timeoutSeconds) || timeoutSeconds <= 0) {
      return badRequest(res, 'Invalid timeoutSeconds'), true;
    }

    try {
      const result = await sendAgentMessage({
        sessionId,
        agentId,
        message,
        thinking,
        timeoutSeconds,
      });

      if (!result.ok) {
        return serverError(res, 'OpenClaw agent command failed', {
          code: result.code,
          signal: result.signal,
          stdout: result.stdout,
          stderr: result.stderr,
        }), true;
      }

      ok(res, result);
    } catch (error) {
      serverError(res, error.message || 'Failed to invoke OpenClaw agent');
    }
    return true;
  }

  if (pathname === '/api/openclaw/skills/agent-task-intake' && req.method === 'POST') {
    try {
      const config = readWebuiConfig();
      const content = buildChatAgentPrompt({
        config,
        dataRoot: getBaseDir(),
      });
      const result = installAgentTaskIntakeSkill(content);
      ok(res, {
        ...result,
        stdout: [
          '已写入 agent-task-intake SKILL',
          `路径: ${result.filePath}`,
        ].join('\n'),
      });
    } catch (error) {
      serverError(res, error.message || 'Failed to install OpenClaw skill');
    }
    return true;
  }

  if (pathname === '/api/openclaw/skills/agent-task-intake' && req.method === 'DELETE') {
    try {
      const result = removeAgentTaskIntakeSkill();
      ok(res, {
        ...result,
        stdout: [
          result.existed
            ? '已移除 agent-task-intake SKILL'
            : '未发现 agent-task-intake SKILL',
          `路径: ${result.filePath}`,
        ].join('\n'),
      });
    } catch (error) {
      serverError(res, error.message || 'Failed to remove OpenClaw skill');
    }
    return true;
  }

  if (pathname === '/api/openclaw/gateway/restart' && req.method === 'POST') {
    try {
      const result = await restartGateway();

      if (!result.ok) {
        return serverError(res, 'OpenClaw gateway restart failed', {
          code: result.code,
          signal: result.signal,
          stdout: result.stdout,
          stderr: result.stderr,
        }), true;
      }

      ok(res, result);
    } catch (error) {
      serverError(res, error.message || 'Failed to restart OpenClaw gateway');
    }
    return true;
  }

  if (pathname === '/api/system/logs' && req.method === 'GET') {
    ok(res, readSystemLogs(searchParams.get('limit')));
    return true;
  }

  return false;
}
