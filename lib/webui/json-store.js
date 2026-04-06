import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { getBaseDir } from '../db.js';

/**
 * 确保目录存在
 * @param {string} dir 目录路径
 */
function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * 读取 JSON 文件
 * @param {string} filePath 文件路径
 * @param {*} defaultValue 默认值（读取失败时返回）
 * @returns {*} 解析后的 JSON 数据或默认值
 */
export function readJsonFile(filePath, defaultValue = null) {
  if (!existsSync(filePath)) {
    return defaultValue;
  }
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    return defaultValue;
  }
}

/**
 * 写入 JSON 文件
 * @param {string} filePath 文件路径
 * @param {*} data 要写入的数据
 */
export function writeJsonFile(filePath, data) {
  const dir = dirname(filePath);
  ensureDir(dir);

  // Write via a temp file so config/token updates do not leave partial JSON on interruption.
  const tempPath = join(dir, `.${randomUUID()}.tmp`);
  writeFileSync(tempPath, JSON.stringify(data, null, 2), {
    encoding: 'utf-8',
    mode: 0o600,
  });
  renameSync(tempPath, filePath);
}

/**
 * 读取项目目录下的 JSON 文件
 * @param {string} filename 文件名
 * @param {*} defaultValue 默认值
 * @returns {*} 解析后的数据或默认值
 */
export function readProjectJson(filename, defaultValue = null) {
  return readJsonFile(join(getBaseDir(), filename), defaultValue);
}

/**
 * 写入项目目录下的 JSON 文件
 * @param {string} filename 文件名
 * @param {*} data 要写入的数据
 */
export function writeProjectJson(filename, data) {
  writeJsonFile(join(getBaseDir(), filename), data);
}
