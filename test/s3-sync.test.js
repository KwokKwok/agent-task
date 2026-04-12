import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const { isS3EnabledMock, uploadToS3Mock } = vi.hoisted(() => ({
  isS3EnabledMock: vi.fn(() => true),
  uploadToS3Mock: vi.fn(),
}));

vi.mock('../lib/webui/s3-client.js', async () => {
  const actual = await vi.importActual('../lib/webui/s3-client.js');
  return {
    ...actual,
    isS3Enabled: isS3EnabledMock,
    uploadToS3: uploadToS3Mock,
  };
});

import { getDb, resetDb } from '../lib/db.js';
import { ensureFileSyncedToS3 } from '../lib/webui/s3-sync.js';

describe('s3 sync helpers', () => {
  let tmpDir;

  beforeEach(() => {
    if (tmpDir) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
    tmpDir = mkdtempSync(join(tmpdir(), 'agent-task-s3-sync-'));
    process.env.AGENT_TASK_HOME = tmpDir;
    process.env.OPENCLAW_HOME = tmpDir;
    resetDb();
    uploadToS3Mock.mockReset();
    uploadToS3Mock.mockResolvedValue(undefined);
    isS3EnabledMock.mockReset();
    isS3EnabledMock.mockReturnValue(true);
  });

  it('uploads font assets with the correct content type', async () => {
    const filePath = join(tmpDir, 'assets', 'demo.ttf');
    mkdirSync(join(tmpDir, 'assets'), { recursive: true });
    writeFileSync(filePath, 'fake-font');

    const synced = await ensureFileSyncedToS3('assets/demo.ttf', filePath);

    expect(synced).toBe(true);
    expect(uploadToS3Mock).toHaveBeenCalledWith(
      'assets/demo.ttf',
      expect.any(Buffer),
      'font/ttf',
    );
  });

  it('reuploads cached assets when legacy sync rows are missing content type metadata', async () => {
    const db = getDb();
    const filePath = join(tmpDir, 'assets', 'demo.ttf');
    mkdirSync(join(tmpDir, 'assets'), { recursive: true });
    writeFileSync(filePath, 'fake-font');
    const stat = statSync(filePath);

    db.prepare(`
      INSERT INTO s3_sync_cache (s3_key, file_size, file_mtime_ms, content_type, synced_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('assets/demo.ttf', stat.size, stat.mtimeMs, null, Math.floor(Date.now() / 1000));

    await ensureFileSyncedToS3('assets/demo.ttf', filePath);

    expect(uploadToS3Mock).toHaveBeenCalledOnce();
    expect(uploadToS3Mock).toHaveBeenCalledWith(
      'assets/demo.ttf',
      expect.any(Buffer),
      'font/ttf',
    );
  });
});
