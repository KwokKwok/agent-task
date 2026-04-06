import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resetDb } from '../lib/db.js';
import { ensureToken, getToken, resetToken } from '../lib/webui/token-store.js';

let tmpDir;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'agent-task-webui-token-'));
  process.env.AGENT_TASK_HOME = tmpDir;
});

afterEach(() => {
  resetDb();
  rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.AGENT_TASK_HOME;
});

describe('webui token store', () => {
  it('ensureToken is idempotent', () => {
    const a = ensureToken();
    const b = ensureToken();
    expect(a).toBe(b);
    expect(getToken()).toBe(a);
  });

  it('resetToken rotates token', () => {
    const a = ensureToken();
    const b = resetToken();
    expect(b).not.toBe(a);
    expect(getToken()).toBe(b);
  });
});
