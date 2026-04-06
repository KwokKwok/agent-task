import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resetDb } from '../lib/db.js';
import { createWorkspace, ensureWorkspace, syncTaskJson, archiveWorkspace } from '../lib/workspace.js';

let tmpDir;

const mockTask = (id, overrides = {}) => ({
  id,
  title: '测试任务',
  description: '任务描述',
  status: 'todo',
  priority: 'medium',
  workspace_path: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'agent-task-ws-test-'));
  process.env.AGENT_TASK_HOME = tmpDir;
});

afterEach(() => {
  resetDb();
  rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.AGENT_TASK_HOME;
});

describe('创建工作目录', () => {
  it('创建目录并生成所有标准文件', () => {
    const wsPath = createWorkspace('abc12345', mockTask('abc12345'));

    expect(existsSync(wsPath)).toBe(true);
    expect(wsPath).toContain('task-abc12345');

    const expectedFiles = ['task.json', 'report.md'];
    for (const file of expectedFiles) {
      expect(existsSync(join(wsPath, file))).toBe(true);
    }
    expect(existsSync(join(wsPath, 'work'))).toBe(true);
  });

  it('task.json sidecar 包含完整元数据', () => {
    const task = mockTask('abc12345');
    const wsPath = createWorkspace('abc12345', task);
    const json = JSON.parse(readFileSync(join(wsPath, 'task.json'), 'utf-8'));

    expect(json.id).toBe('abc12345');
    expect(json.title).toBe('测试任务');
    expect(json.status).toBe('todo');
  });

  it('重复创建应幂等（不覆盖已有目录）', () => {
    const task = mockTask('abc12345');
    const ws1 = createWorkspace('abc12345', task);
    const ws2 = createWorkspace('abc12345', task);

    expect(ws1).toBe(ws2);
  });
});

describe('确保工作目录存在', () => {
  it('不存在时自动创建', () => {
    const task = mockTask('def67890');
    const wsPath = ensureWorkspace('def67890', task);

    expect(existsSync(wsPath)).toBe(true);
  });

  it('已存在时直接返回现有路径', () => {
    const task = mockTask('def67890');
    const wsPath = createWorkspace('def67890', task);
    const ensured = ensureWorkspace('def67890', { ...task, workspace_path: wsPath });

    expect(ensured).toBe(wsPath);
  });
});

describe('同步 task.json', () => {
  it('更新工作目录中的 task.json', () => {
    const task = mockTask('sync1234');
    const wsPath = createWorkspace('sync1234', task);

    const updated = { ...task, status: 'in_progress', workspace_path: wsPath };
    syncTaskJson(wsPath, updated);

    const json = JSON.parse(readFileSync(join(wsPath, 'task.json'), 'utf-8'));
    expect(json.status).toBe('in_progress');
  });

  it('路径不存在时不报错', () => {
    expect(() => syncTaskJson('/nonexistent/path', {})).not.toThrow();
  });
});

describe('归档工作目录', () => {
  it('压缩为 tar.gz 并删除原目录', () => {
    const task = mockTask('arch1234');
    const wsPath = createWorkspace('arch1234', task);

    const archivePath = archiveWorkspace('arch1234', wsPath);

    expect(archivePath).toContain('task-arch1234.tar.gz');
    expect(existsSync(archivePath)).toBe(true);
    expect(existsSync(wsPath)).toBe(false);
  });

  it('工作目录不存在时返回 null', () => {
    expect(archiveWorkspace('nope', '/nonexistent')).toBeNull();
    expect(archiveWorkspace('nope', null)).toBeNull();
  });
});
