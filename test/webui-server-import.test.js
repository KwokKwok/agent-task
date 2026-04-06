import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

let tmpDir;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'agent-task-webui-import-'));
  process.env.AGENT_TASK_HOME = tmpDir;
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.AGENT_TASK_HOME;
});

describe('webui module imports', () => {
  it('imports api.js under native node esm without export mismatches', () => {
    const out = execFileSync(
      'node',
      ['-e', "import('./lib/webui/api.js').then(()=>console.log('ok'))"],
      {
        cwd: process.cwd(),
        encoding: 'utf-8',
        env: { ...process.env, AGENT_TASK_HOME: tmpDir },
      },
    );

    expect(out.trim()).toBe('ok');
  });

  it('imports server.js under native node esm without export mismatches', () => {
    const out = execFileSync(
      'node',
      ['-e', "import('./lib/webui/server.js').then(()=>console.log('ok'))"],
      {
        cwd: process.cwd(),
        encoding: 'utf-8',
        env: { ...process.env, AGENT_TASK_HOME: tmpDir },
      },
    );

    expect(out.trim()).toBe('ok');
  });
});
