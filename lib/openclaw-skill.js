import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { getOpenClawHome } from './db.js';

const AGENT_TASK_INTAKE_SKILL_ID = 'agent-task-intake';

export function getOpenClawSkillsDir() {
  return join(getOpenClawHome(), 'skills');
}

export function getAgentTaskIntakeSkillDir() {
  return join(getOpenClawSkillsDir(), AGENT_TASK_INTAKE_SKILL_ID);
}

export function getAgentTaskIntakeSkillFile() {
  return join(getAgentTaskIntakeSkillDir(), 'SKILL.md');
}

export function installAgentTaskIntakeSkill(content) {
  const normalizedContent = String(content ?? '').trim();
  if (!normalizedContent) {
    throw new Error('Skill content is empty');
  }

  const skillDir = getAgentTaskIntakeSkillDir();
  const filePath = getAgentTaskIntakeSkillFile();
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(filePath, `${normalizedContent}\n`, 'utf-8');

  return {
    skillId: AGENT_TASK_INTAKE_SKILL_ID,
    skillDir,
    filePath,
    bytes: Buffer.byteLength(`${normalizedContent}\n`, 'utf-8'),
  };
}

export function removeAgentTaskIntakeSkill() {
  const skillDir = getAgentTaskIntakeSkillDir();
  const filePath = getAgentTaskIntakeSkillFile();
  const existed = existsSync(skillDir);

  rmSync(skillDir, { recursive: true, force: true });

  return {
    skillId: AGENT_TASK_INTAKE_SKILL_ID,
    skillDir,
    filePath,
    existed,
    removed: true,
  };
}
