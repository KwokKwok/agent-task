import { getBaseDir } from './db.js';
import { readWebuiConfig } from './webui/config-store.js';
import { buildChatAgentPrompt } from './prompt-builders.js';

export function buildAgentPrompt() {
  return buildChatAgentPrompt({
    dataRoot: getBaseDir(),
    config: readWebuiConfig(),
  });
}
