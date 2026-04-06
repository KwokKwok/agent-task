import { spawn } from 'node:child_process';

import { getTaskFeedback } from './task.js';
import { resolveOpenClawSpawnEnv } from './openclaw.js';
import { buildExecutionPrompt } from './prompt-builders.js';
import { readWebuiConfig } from './webui/config-store.js';

export { resolveOpenClawSpawnEnv } from './openclaw.js';

export function buildDispatchPrompt(task, context) {
  const feedback = getTaskFeedback(task.id);

  return buildExecutionPrompt({
    task,
    config: context.config || readWebuiConfig(),
    mode: 'dispatch',
    sessionKey: context.sessionKey,
    timeoutSeconds: context.timeoutSeconds,
    feedback,
  });
}

export function buildRepairPrompt(task, context) {
  const feedback = getTaskFeedback(task.id);

  return buildExecutionPrompt({
    task,
    config: context.config || readWebuiConfig(),
    mode: 'repair',
    sessionKey: context.sessionKey,
    timeoutSeconds: context.timeoutSeconds,
    feedback,
  });
}

export async function invokeOpenClawAgent({
  sessionKey,
  prompt,
  timeoutSeconds = 1800,
  thinking = 'off',
}) {
  const env = resolveOpenClawSpawnEnv();

  await new Promise((resolve, reject) => {
    const child = spawn('openclaw', [
      'agent',
      '--session-id',
      sessionKey,
      '--message',
      prompt,
      '--thinking',
      thinking || 'off',
      '--timeout',
      String(timeoutSeconds),
    ], {
      env,
      stdio: 'ignore',
    });

    child.once('error', reject);
    child.once('spawn', resolve);
  });
}
