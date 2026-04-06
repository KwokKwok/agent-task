import { marked } from 'marked';
import DOMPurify from 'dompurify';
import {
  EVENT_LABEL,
  PRIORITY_LABEL,
  PRIORITY_RANK,
  STATUS_META,
  STATUS_VALUES,
  TAB_VALUES,
} from '../constants';

marked.setOptions({ gfm: true, breaks: true });

export function escapeHtml(input) {
  return String(input)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function markdownToHtml(md) {
  try {
    return DOMPurify.sanitize(marked.parse(String(md || '')));
  } catch {
    return DOMPurify.sanitize(`<p>${escapeHtml(String(md || ''))}</p>`);
  }
}

export function getStatusMeta(status) {
  return STATUS_META[status] || { label: '未知', tone: 'default' };
}

export function getStatusLabel(status) {
  return getStatusMeta(status).label;
}

export function formatPriority(priority) {
  return PRIORITY_LABEL[priority] || '中';
}

export function mapEventType(type) {
  return EVENT_LABEL[type] || type;
}

function mapTriggerSourceLabel(source) {
  const value = String(source || '').trim();
  if (value === 'task_created') return '新建任务';
  if (value === 'feedback_reject') return '驳回反馈';
  if (value === 'interval') return '定时检查';
  return value;
}

export function mapStatusText(text) {
  let next = String(text || '');
  for (const status of STATUS_VALUES) {
    const regex = new RegExp(`\\b${status}\\b`, 'g');
    next = next.replace(regex, getStatusLabel(status));
  }
  next = next.replace(
    /^Returned to 待开始 for follow-up$/i,
    '已驳回，回到待开始，等待继续处理',
  );
  next = next.replace(
    /^Scheduled by WebUI dispatcher$/i,
    '已由 WebUI 调度器加入执行队列',
  );
  next = next.replace(
    /^Automatic dispatch started \((.+)\)$/i,
    (_, source) => `已触发自动派发（来源：${mapTriggerSourceLabel(source)}）`,
  );
  next = next.replace(
    /^Automatic repair started \((.+)\)$/i,
    (_, source) => `已触发自动续作（来源：${mapTriggerSourceLabel(source)}）`,
  );
  next = next.replace(
    /^Automatic repair limit reached$/i,
    '自动续作次数已用尽',
  );
  next = next.replace(
    /^Dispatch timed out after (\d+)s$/i,
    (_, seconds) => `执行超时（${seconds} 秒）`,
  );
  next = next.replace(
    /^Timed out before completion$/i,
    '执行超时，任务尚未完成',
  );
  next = next.replace(
    /^Automatic dispatch failed$/i,
    '自动派发失败',
  );
  next = next.replace(
    /^Automatic repair failed$/i,
    '自动续作失败',
  );
  return next;
}

export function sortByPriorityThenTime(items) {
  return [...items].sort((a, b) => {
    const priorityDiff =
      (PRIORITY_RANK[b.priority] || 0) - (PRIORITY_RANK[a.priority] || 0);
    if (priorityDiff !== 0) return priorityDiff;
    return (
      new Date(a.updated_at || 0).getTime() -
      new Date(b.updated_at || 0).getTime()
    );
  });
}

export function sortByTimeDesc(items) {
  return [...items].sort((a, b) =>
    new Date(b.updated_at || 0).getTime() -
    new Date(a.updated_at || 0).getTime(),
  );
}

export function readableFileSize(bytes) {
  const size = Number(bytes || 0);
  if (!Number.isFinite(size) || size < 0) return '--';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export async function fetchJson(path) {
  const res = await fetch(path, { credentials: 'include' });
  if (!res.ok) {
    const text = await res.text();
    try {
      const data = JSON.parse(text);
      throw new Error(data.error || `HTTP ${res.status}`);
    } catch {
      throw new Error(text || `HTTP ${res.status}`);
    }
  }
  return res.json();
}

export function resolveInitialTaskAndTab() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  const taskId = parts.length >= 2 && parts[0] === 'task' ? parts[1] : null;
  const hash = (window.location.hash || '').replace(/^#/, '');
  const tab = TAB_VALUES.includes(hash) ? hash : 'overview';
  return { taskId, tab };
}

export function syncTaskRoute(taskId, tab) {
  const next = taskId
    ? `/task/${taskId}${tab && tab !== 'overview' ? `#${tab}` : ''}`
    : '/';
  if (`${window.location.pathname}${window.location.hash}` !== next) {
    window.history.replaceState(null, '', next);
  }
}
