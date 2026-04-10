import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_ROOT = resolve(MODULE_DIR, '../docs/prompt-templates');

const TEMPLATE_TYPES = {
  chat: 'agent-intake-skill.md',
  execution: 'agent-execution.md',
};

function normalizeTemplateContent (content) {
  const value = String(content ?? '').trim();
  return value;
}

export function getPromptTemplateFile (type) {
  const fileName = TEMPLATE_TYPES[type];
  if (!fileName) {
    throw new Error(`Unknown prompt template type: ${type}`);
  }
  return resolve(TEMPLATE_ROOT, fileName);
}

export function readPromptTemplateFile (type) {
  const filePath = getPromptTemplateFile(type);
  try {
    const content = normalizeTemplateContent(readFileSync(filePath, 'utf-8'));
    if (!content) {
      throw new Error(`Prompt template is empty: ${filePath}`);
    }
    return content;
  } catch (error) {
    const reason = error instanceof Error && error.message ? error.message : 'unknown error';
    throw new Error(`Failed to read prompt template: ${filePath} (${reason})`);
  }
}

export function readDefaultPromptTemplates () {
  return {
    chat: readPromptTemplateFile('chat'),
    execution: readPromptTemplateFile('execution'),
  };
}
