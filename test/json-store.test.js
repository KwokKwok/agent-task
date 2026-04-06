import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { resetDb } from '../lib/db.js';
import { readJsonFile, writeJsonFile } from '../lib/webui/json-store.js';

let tmpDir;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'agent-task-json-store-'));
  process.env.AGENT_TASK_HOME = tmpDir;
});

afterEach(() => {
  resetDb();
  rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.AGENT_TASK_HOME;
});

describe('json store', () => {
  it('writes json data and reads it back', () => {
    const filePath = join(tmpDir, 'nested', 'sample.json');
    writeJsonFile(filePath, { ok: true, count: 2 });

    expect(existsSync(filePath)).toBe(true);
    expect(readJsonFile(filePath, null)).toEqual({ ok: true, count: 2 });
  });

  it('does not leave temp files behind after atomic write', () => {
    const dirPath = join(tmpDir, 'nested');
    const filePath = join(dirPath, 'sample.json');
    writeJsonFile(filePath, { ok: true });

    const files = readdirSync(dirPath);

    expect(files).toEqual(['sample.json']);
  });
});
