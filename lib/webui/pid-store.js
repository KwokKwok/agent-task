import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { readJsonFile, writeJsonFile } from './json-store.js';
import { getBaseDir } from '../db.js';

function getPidFile() {
  return join(getBaseDir(), 'webui.pid.json');
}

export function readPidInfo() {
  return readJsonFile(getPidFile(), null);
}

export function writePidInfo(info) {
  writeJsonFile(getPidFile(), info);
}

export function clearPidInfo(expectedPid) {
  const file = getPidFile();
  if (!file) return false;

  if (expectedPid !== undefined && expectedPid !== null) {
    const current = readPidInfo();
    if (!current || Number(current.pid) !== Number(expectedPid)) {
      return false;
    }
  }

  rmSync(file, { force: true });
  return true;
}

export function isProcessAlive(pid) {
  if (!pid || Number.isNaN(Number(pid))) return false;
  try {
    process.kill(Number(pid), 0);
    return true;
  } catch {
    return false;
  }
}

export function getPidFilePath() {
  return getPidFile();
}
