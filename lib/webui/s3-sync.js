import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { getAssetsDir } from '../resource-cache.js';
import { getDb } from '../db.js';
import { isS3Enabled, uploadToS3 } from './s3-client.js';

const S3_MIME_TYPES = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
  '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4',
  '.flac': 'audio/flac',
  '.txt': 'text/plain; charset=utf-8',
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.pdf': 'application/pdf',
};

function getMimeType(filePath) {
  return S3_MIME_TYPES[extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function walkDir(dir, base = '') {
  const results = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const relPath = base ? `${base}/${entry.name}` : entry.name;
      const absPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...walkDir(absPath, relPath));
      } else {
        results.push({ relPath, absPath });
      }
    }
  } catch {
    // unreadable
  }
  return results;
}

function upsertSyncCache(s3Key, fileSize, fileMtimeMs, contentType) {
  const db = getDb();
  const now = Math.floor(Date.now() / 1000);
  db.prepare(`
    INSERT INTO s3_sync_cache (s3_key, file_size, file_mtime_ms, content_type, synced_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(s3_key) DO UPDATE SET
      file_size = excluded.file_size,
      file_mtime_ms = excluded.file_mtime_ms,
      content_type = excluded.content_type,
      synced_at = excluded.synced_at
  `).run(s3Key, fileSize, fileMtimeMs, contentType, now);
}

/**
 * 检查 s3_sync_cache 中是否有该 key 的同步记录，且文件未变。
 * 返回 { synced: boolean, cacheRow?: { file_size, file_mtime_ms } }
 */
export function checkS3SyncCache(s3Key, fileSize, fileMtimeMs, contentType) {
  const db = getDb();
  const row = db.prepare('SELECT file_size, file_mtime_ms, content_type FROM s3_sync_cache WHERE s3_key = ?').get(s3Key);
  if (!row) return { synced: false };
  return {
    synced:
      row.file_size === fileSize
      && row.file_mtime_ms === fileMtimeMs
      && row.content_type === contentType,
  };
}

export async function syncAssetsToS3() {
  if (!isS3Enabled()) return;

  const assetsDir = getAssetsDir();
  const files = walkDir(assetsDir);
  for (const file of files) {
    const s3Key = `assets/${file.relPath}`;
    try {
      const stat = statSync(file.absPath);
      const contentType = getMimeType(file.absPath);
      const { synced } = checkS3SyncCache(s3Key, stat.size, stat.mtimeMs, contentType);
      if (synced) continue;
      const body = readFileSync(file.absPath);
      await uploadToS3(s3Key, body, contentType);
      upsertSyncCache(s3Key, stat.size, stat.mtimeMs, contentType);
    } catch (err) {
      console.error(`[s3-sync] Failed to sync asset ${s3Key}: ${err.message}`);
    }
  }
}

/**
 * 按需同步单个文件到 S3。
 * 如果同步失败返回 false。
 */
export async function ensureFileSyncedToS3(s3Key, localAbsPath) {
  try {
    const stat = statSync(localAbsPath);
    const contentType = getMimeType(localAbsPath);
    const { synced } = checkS3SyncCache(s3Key, stat.size, stat.mtimeMs, contentType);
    if (!synced) {
      const body = readFileSync(localAbsPath);
      await uploadToS3(s3Key, body, contentType);
      upsertSyncCache(s3Key, stat.size, stat.mtimeMs, contentType);
    }
    return true;
  } catch (err) {
    console.error(`[s3-sync] On-demand sync failed for ${s3Key}: ${err.message}`);
    return false;
  }
}
