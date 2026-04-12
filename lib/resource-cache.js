import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { extname, join } from 'node:path';

import { getBaseDir } from './db.js';
import { listTasks } from './task.js';

const ASSET_MANIFEST = 'manifest.json';
const MIME_EXTENSION_MAP = new Map([
  ['text/css', '.css'],
  ['text/javascript', '.js'],
  ['application/javascript', '.js'],
  ['application/x-javascript', '.js'],
  ['application/json', '.json'],
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
  ['image/svg+xml', '.svg'],
  ['image/avif', '.avif'],
  ['image/bmp', '.bmp'],
  ['audio/mpeg', '.mp3'],
  ['audio/wav', '.wav'],
  ['audio/ogg', '.ogg'],
  ['audio/mp4', '.m4a'],
  ['video/mp4', '.mp4'],
  ['video/webm', '.webm'],
  ['font/woff2', '.woff2'],
  ['font/woff', '.woff'],
  ['font/ttf', '.ttf'],
  ['font/otf', '.otf'],
  ['application/font-woff', '.woff'],
  ['application/font-woff2', '.woff2'],
  ['application/vnd.ms-fontobject', '.eot'],
]);

function normalizeContentType(value) {
  return String(value || '').split(';')[0].trim().toLowerCase();
}

function toAssetUrl(filename) {
  return `/api/assets/${filename}`;
}

function hashUrl(url) {
  return createHash('sha256').update(url).digest('hex').slice(0, 12);
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(value);
}

function getAssetManifestPath() {
  return join(getAssetsDir(), ASSET_MANIFEST);
}

function readAssetManifest() {
  const path = getAssetManifestPath();
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf-8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeAssetManifest(manifest) {
  writeFileSync(getAssetManifestPath(), JSON.stringify(manifest, null, 2));
}

function inferExtension(url, contentType) {
  const normalizedType = normalizeContentType(contentType);
  if (MIME_EXTENSION_MAP.has(normalizedType)) {
    return MIME_EXTENSION_MAP.get(normalizedType);
  }

  try {
    const pathname = new URL(url).pathname;
    const pathExt = extname(pathname);
    if (pathExt) return pathExt.toLowerCase();
  } catch {
    // Ignore invalid URLs here.
  }

  return '.bin';
}

function resolveExternalUrl(baseUrl, candidate) {
  const raw = String(candidate || '').trim().replace(/^['"]|['"]$/g, '');
  if (!raw || raw.startsWith('data:') || raw.startsWith('blob:') || raw.startsWith('#')) {
    return null;
  }

  try {
    const url = new URL(raw, baseUrl);
    return isHttpUrl(url.toString()) ? url.toString() : null;
  } catch {
    return null;
  }
}

function cleanupPreviousAsset(filename) {
  if (!filename) return;
  const target = join(getAssetsDir(), filename);
  if (!existsSync(target)) return;
  try {
    unlinkSync(target);
  } catch {
    // Ignore stale file cleanup failures.
  }
}

function localizeTagResource(tag, originalUrl, filename) {
  return tag.replace(originalUrl, toAssetUrl(filename));
}

function findReplacementRanges(input, regexFactory) {
  const regex = regexFactory();
  const matches = [];
  let match;
  while ((match = regex.exec(input)) !== null) {
    matches.push(match);
  }
  return matches;
}

async function localizeCssContent(cssText, sourceUrl, context) {
  let modified = cssText;
  const replacements = [];
  const importRanges = [];

  const importMatches = findReplacementRanges(
    cssText,
    () => /@import\s+(?:url\(\s*)?(?:['"]?)([^"')\s]+)(?:['"]?)(?:\s*\))?([^;]*);/gi,
  );
  for (const match of importMatches) {
    const resolvedUrl = resolveExternalUrl(sourceUrl, match[1]);
    if (!resolvedUrl) continue;
    const cached = await downloadAndCache(resolvedUrl, context);
    importRanges.push([match.index, match.index + match[0].length]);
    replacements.push({
      start: match.index,
      end: match.index + match[0].length,
      value: `@import url("${toAssetUrl(cached.filename)}")${match[2] || ''};`,
    });
  }

  const urlMatches = findReplacementRanges(cssText, () => /url\(\s*(['"]?)([^"')]+)\1\s*\)/gi);
  for (const match of urlMatches) {
    const insideImport = importRanges.some(([start, end]) => match.index >= start && match.index < end);
    if (insideImport) continue;
    const resolvedUrl = resolveExternalUrl(sourceUrl, match[2]);
    if (!resolvedUrl) continue;
    const cached = await downloadAndCache(resolvedUrl, context);
    replacements.push({
      start: match.index,
      end: match.index + match[0].length,
      value: `url("${toAssetUrl(cached.filename)}")`,
    });
  }

  replacements
    .sort((a, b) => b.start - a.start)
    .forEach((replacement) => {
      modified = modified.slice(0, replacement.start)
        + replacement.value
        + modified.slice(replacement.end);
    });

  return modified;
}

async function downloadAndCache(url, context) {
  if (context.inFlight.has(url)) {
    return context.inFlight.get(url);
  }

  const existing = context.manifest[url];
  if (existing?.filename && existsSync(join(getAssetsDir(), existing.filename))) {
    const cached = {
      filename: existing.filename,
      contentType: normalizeContentType(existing.contentType),
    };
    context.inFlight.set(url, Promise.resolve(cached));
    return cached;
  }

  const pending = (async () => {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(30_000),
      headers: { 'User-Agent': 'agent-task/resource-cache' },
    });
    if (!response.ok) {
      throw new Error(`Failed to download ${url}: ${response.status}`);
    }

    const contentType = normalizeContentType(response.headers.get('content-type'));
    const bodyBuffer = Buffer.from(await response.arrayBuffer());
    const extension = inferExtension(url, contentType);
    const filename = `${hashUrl(url)}${extension}`;
    let body = bodyBuffer;

    if (contentType === 'text/css' || extension === '.css') {
      const localizedCss = await localizeCssContent(bodyBuffer.toString('utf-8'), url, context);
      body = Buffer.from(localizedCss);
    }

    const previousFilename = context.manifest[url]?.filename;
    writeFileSync(join(getAssetsDir(), filename), body);
    if (previousFilename && previousFilename !== filename) {
      cleanupPreviousAsset(previousFilename);
    }

    context.manifest[url] = {
      filename,
      contentType: contentType || null,
      updatedAt: new Date().toISOString(),
    };
    context.dirty = true;

    return { filename, contentType };
  })();

  context.inFlight.set(url, pending);
  try {
    return await pending;
  } finally {
    context.inFlight.delete(url);
  }
}

function extractExternalResources(html) {
  const resources = [];
  const patterns = [
    /<link\s[^>]*>/gi,
    /<script\s[^>]*src=["'][^"']+["'][^>]*>\s*<\/script>/gi,
    /<img\s[^>]*src=["'][^"']+["'][^>]*>/gi,
    /<source\s[^>]*src=["'][^"']+["'][^>]*>/gi,
    /<video\s[^>]*poster=["'][^"']+["'][^>]*>/gi,
    /<audio\s[^>]*src=["'][^"']+["'][^>]*>/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const tag = match[0];
      let attrMatch = tag.match(/\shref=["']([^"']+)["']/i);

      if (tag.startsWith('<link')) {
        const relMatch = tag.match(/\srel=["']([^"']+)["']/i);
        const rels = String(relMatch?.[1] || '').toLowerCase().split(/\s+/).filter(Boolean);
        const allowed = rels.includes('stylesheet') || rels.includes('preload') || rels.includes('modulepreload');
        if (!allowed) continue;
        if (!attrMatch) continue;
      } else {
        attrMatch = tag.match(/\ssrc=["']([^"']+)["']/i) || tag.match(/\sposter=["']([^"']+)["']/i);
        if (!attrMatch) continue;
      }

      const url = attrMatch[1];
      if (!isHttpUrl(url)) continue;
      resources.push({
        url,
        tag,
        index: match.index,
        length: match[0].length,
      });
    }
  }

  return resources;
}

export function getAssetsDir() {
  const dir = join(getBaseDir(), 'assets');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function getAssetsStats() {
  const dir = getAssetsDir();
  let count = 0;
  let totalSize = 0;
  try {
    const files = readdirSync(dir);
    for (const file of files) {
      if (file === ASSET_MANIFEST) continue;
      const stat = statSync(join(dir, file));
      if (stat.isFile()) {
        count += 1;
        totalSize += stat.size;
      }
    }
  } catch {
    // Ignore missing or unreadable cache directory.
  }
  return { count, totalSize };
}

export async function cacheExternalResources(workspacePath) {
  if (!workspacePath || !existsSync(workspacePath)) return [];

  const htmlPath = join(workspacePath, 'report.html');
  if (!existsSync(htmlPath)) return [];

  const html = readFileSync(htmlPath, 'utf-8');
  const resources = extractExternalResources(html);
  if (!resources.length) return [];

  const context = {
    manifest: readAssetManifest(),
    dirty: false,
    inFlight: new Map(),
  };
  const cached = [];

  for (let index = 0; index < resources.length; index += 1) {
    const resource = resources[index];
    try {
      const downloaded = await downloadAndCache(resource.url, context);
      cached.push({ url: resource.url, filename: downloaded.filename });
    } catch (error) {
      console.error(`[resource-cache] Failed to cache ${resource.url}: ${error.message}`);
    }
  }

  if (context.dirty) {
    writeAssetManifest(context.manifest);
  }

  return cached;
}

export function rewriteHtmlWithCachedExternalResources(html) {
  if (!html) return html;

  const resources = extractExternalResources(html);
  if (!resources.length) return html;

  const manifest = readAssetManifest();
  let modified = html;

  for (let index = resources.length - 1; index >= 0; index -= 1) {
    const resource = resources[index];
    const filename = manifest[resource.url]?.filename;
    if (!filename) continue;
    if (!existsSync(join(getAssetsDir(), filename))) continue;

    modified = modified.slice(0, resource.index)
      + localizeTagResource(resource.tag, resource.url, filename)
      + modified.slice(resource.index + resource.length);
  }

  return modified;
}

export async function scanAllTasks() {
  const tasks = listTasks({ all: true });
  let scanned = 0;
  let cached = 0;
  let errors = 0;

  for (const task of tasks) {
    if (task.status === 'archived') continue;
    if (!task.workspace_path || !existsSync(task.workspace_path)) continue;
    const htmlPath = join(task.workspace_path, 'report.html');
    if (!existsSync(htmlPath)) continue;

    scanned += 1;
    try {
      const result = await cacheExternalResources(task.workspace_path);
      cached += result.length;
    } catch (error) {
      errors += 1;
      console.error(`[resource-cache] scan failed for ${task.id}: ${error.message}`);
    }
  }

  return { scanned, cached, errors };
}
