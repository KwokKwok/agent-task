import { copyFileSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join, basename, dirname, extname } from 'node:path';
import { execSync } from 'node:child_process';
import { getBaseDir } from './db.js';

function getWorkspaceDateParts(createdAt) {
  const date = createdAt ? new Date(createdAt) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  return {
    yyyy: String(safeDate.getFullYear()),
    mm: String(safeDate.getMonth() + 1).padStart(2, '0'),
    dd: String(safeDate.getDate()).padStart(2, '0'),
  };
}

function getWorkspaceSuffix(workspacePath) {
  const normalizedPath = String(workspacePath || '').replace(/\\/g, '/');
  const marker = '/tasks/';
  const idx = normalizedPath.indexOf(marker);
  if (idx < 0) return null;
  return normalizedPath.slice(idx + marker.length);
}

/**
 * 生成 workspace 路径：<root>/agent-task/tasks/YYYY/MM/DD/task-<uuid>/
 */
export function getWorkspacePath(taskId, createdAt = null) {
  const { yyyy, mm, dd } = getWorkspaceDateParts(createdAt);
  return join(getBaseDir(), 'tasks', yyyy, mm, dd, `task-${taskId}`);
}

export function resolveWorkspacePath(taskData) {
  if (!taskData) return null;
  if (taskData.workspace_path && existsSync(taskData.workspace_path)) {
    return taskData.workspace_path;
  }

  const suffix = getWorkspaceSuffix(taskData.workspace_path);
  if (suffix) {
    const remapped = join(getBaseDir(), 'tasks', suffix);
    if (existsSync(remapped)) {
      return remapped;
    }
  }

  const canonical = getWorkspacePath(taskData.id, taskData.created_at);
  if (existsSync(canonical)) {
    return canonical;
  }

  return null;
}

/**
 * 创建 workspace 目录及初始文件
 */
export function createWorkspace(taskId, taskData) {
  const wsPath = taskData.workspace_path || getWorkspacePath(taskId, taskData.created_at);

  if (existsSync(wsPath)) {
    return wsPath;
  }

  mkdirSync(wsPath, { recursive: true });
  mkdirSync(join(wsPath, 'work'), { recursive: true });
  mkdirSync(join(wsPath, 'work', 'report-history'), { recursive: true });

  // task.json — 元数据 sidecar
  writeFileSync(join(wsPath, 'task.json'), JSON.stringify(taskData, null, 2));

  // report.md — 主交付物
  writeFileSync(join(wsPath, 'report.md'), '# 工作记录报告\n\n(待完成)\n');

  return wsPath;
}

/**
 * 确保 workspace 存在，不存在则创建
 */
export function ensureWorkspace(taskId, taskData) {
  const resolved = resolveWorkspacePath(taskData);
  if (resolved) {
    return resolved;
  }
  return createWorkspace(taskId, taskData);
}

/**
 * 同步 task.json sidecar
 */
export function syncTaskJson(workspacePath, taskData) {
  if (!workspacePath || !existsSync(workspacePath)) return;
  writeFileSync(join(workspacePath, 'task.json'), JSON.stringify(taskData, null, 2));
}

/**
 * 归档：压缩 workspace 为 .tar.gz 移入 archive/
 */
export function archiveWorkspace(taskId, workspacePath) {
  if (!workspacePath || !existsSync(workspacePath)) return null;

  const archiveDir = join(getBaseDir(), 'archive');
  mkdirSync(archiveDir, { recursive: true });

  const dirName = basename(workspacePath);
  const archiveName = `task-${taskId}.tar.gz`;
  const archivePath = join(archiveDir, archiveName);
  const parentDir = dirname(workspacePath);

  execSync(`tar -czf "${archivePath}" -C "${parentDir}" "${dirName}"`, { stdio: 'pipe' });
  rmSync(workspacePath, { recursive: true, force: true });

  return archivePath;
}

function makeTimestampTag() {
  return new Date().toISOString().replaceAll(':', '-');
}

export function backupReports(workspacePath) {
  if (!workspacePath || !existsSync(workspacePath)) {
    return [];
  }

  const historyDir = join(workspacePath, 'work', 'report-history');
  mkdirSync(historyDir, { recursive: true });

  const backupPaths = [];
  const files = ['report.md', 'report.html', 'report.mp3', 'report.wav'];
  const stamp = makeTimestampTag();

  for (const name of files) {
    const source = join(workspacePath, name);
    if (!existsSync(source)) continue;
    const ext = extname(name);
    const stem = ext ? name.slice(0, -ext.length) : name;
    const target = join(historyDir, `${stem}-${stamp}${ext}`);
    copyFileSync(source, target);
    backupPaths.push(target);
  }

  return backupPaths;
}
