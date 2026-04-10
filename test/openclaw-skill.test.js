import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { resetDb } from '../lib/db.js';
import {
  getAgentTaskIntakeSkillFile,
  installAgentTaskIntakeSkill,
  removeAgentTaskIntakeSkill,
} from '../lib/openclaw-skill.js';

let agentTaskHome;
let openclawHome;

beforeEach(() => {
  agentTaskHome = mkdtempSync(join(tmpdir(), 'agent-task-home-'));
  openclawHome = mkdtempSync(join(tmpdir(), 'openclaw-home-'));
  process.env.AGENT_TASK_HOME = agentTaskHome;
  process.env.OPENCLAW_HOME = openclawHome;
});

afterEach(() => {
  resetDb();
  rmSync(agentTaskHome, { recursive: true, force: true });
  rmSync(openclawHome, { recursive: true, force: true });
  delete process.env.AGENT_TASK_HOME;
  delete process.env.OPENCLAW_HOME;
});

describe('openclaw skill filesystem helpers', () => {
  it('writes the intake skill under OPENCLAW_HOME instead of AGENT_TASK_HOME', () => {
    const result = installAgentTaskIntakeSkill('# 技能内容');

    expect(result.filePath).toBe(join(openclawHome, 'skills', 'agent-task-intake', 'SKILL.md'));
    expect(result.filePath.startsWith(agentTaskHome)).toBe(false);
    expect(readFileSync(result.filePath, 'utf-8')).toBe('# 技能内容\n');
    expect(getAgentTaskIntakeSkillFile()).toBe(result.filePath);
  });

  it('removes the full intake skill directory', () => {
    const result = installAgentTaskIntakeSkill('# 技能内容');
    const removed = removeAgentTaskIntakeSkill();

    expect(removed.existed).toBe(true);
    expect(removed.filePath).toBe(result.filePath);
    expect(() => readFileSync(result.filePath, 'utf-8')).toThrow();
  });
});
