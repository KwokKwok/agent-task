import { cloneDefaultTaskTypes } from './task-types.js';
import { readDefaultPromptTemplates } from '../prompt-template-store.js';

export const DEFAULT_GENERAL_CONFIG = {
  openclawDefaults: {
    thinking: 'off',
    timeoutSeconds: 1800,
  },
};

const FILE_DEFAULT_TEMPLATES = readDefaultPromptTemplates();

export const DEFAULT_CHAT_TEMPLATE = FILE_DEFAULT_TEMPLATES.chat;
export const DEFAULT_EXECUTION_TEMPLATE = FILE_DEFAULT_TEMPLATES.execution;

export const DEFAULT_EXECUTION_GUIDANCE = {
  template: DEFAULT_EXECUTION_TEMPLATE,
  common: {
    executionApproach:
      '本次执行要求\n'
      + '- 任务执行通用要求。先进入当前 workspace，检查已有文件和上下文。\n'
      + '- 先读取任务 feedback。\n'
      + '- 确认 workspace 并在其中产出文件。\n'
      + '- 必须生成 report.md；如环境支持，建议额外生成 report.html 和 report.mp3。\n'
      + '- 完成后修改状态为 done。\n'
      + '- 如收到反馈，先备份旧报告再修改。',
    deliverable:
      '交付与通知要求\n'
      + '1. 所有交付物都必须写入当前 workspace，且至少需要生成 report.md；如环境支持，建议额外生成 report.html 和 report.mp3。默认推荐分别使用 webpage-designer 和 Gemini TTS，但也可以用其他方式完成。\n'
      + '2. 任务完成后使用 agent-task status <id> done 标记完成；如果当前环境接入了飞书，则必须通过 message 工具发飞书卡片消息给用户（green 主题，包含两个按钮：查看网页报告、查看文字报告，标题和按钮都不需要 emoji）。\n'
      + '3. 重要：调用 sessions_spawn 时必须设置 expectsCompletionMessage: false，任务执行中也不要汇报中间状态，除非被问。避免重复通知。',
    feishuCard:
      '飞书卡片参考\n'
      + '下面是使用 `message` 工具发送飞书卡片的参考结构。按当前环境里的实际参数名填写目标用户和报告链接，但卡片风格请保持为 green 主题，且只保留两个按钮：查看网页报告、查看文字报告。\n'
      + '```javascript\n'
      + 'message({\n'
      + '  action: "send",\n'
      + '  channel: "feishu",\n'
      + '  target: "user:<目标用户ID>",\n'
      + '  card: {\n'
      + '    config: { wide_screen_mode: true },\n'
      + '    header: {\n'
      + '      title: { tag: "plain_text", content: "任务已完成" },\n'
      + '      template: "green",\n'
      + '    },\n'
      + '    elements: [\n'
      + '      {\n'
      + '        tag: "div",\n'
      + '        text: {\n'
      + '          tag: "lark_md",\n'
      + '          content: "任务已完成，可直接查看报告。",\n'
      + '        },\n'
      + '      },\n'
      + '      {\n'
      + '        tag: "action",\n'
      + '        actions: [\n'
      + '          {\n'
      + '            tag: "button",\n'
      + '            text: { tag: "plain_text", content: "查看网页报告" },\n'
      + '            type: "primary",\n'
      + '            url: "<reportHtmlUrl>",\n'
      + '          },\n'
      + '          {\n'
      + '            tag: "button",\n'
      + '            text: { tag: "plain_text", content: "查看文字报告" },\n'
      + '            url: "<reportMarkdownUrl>",\n'
      + '          },\n'
      + '        ],\n'
      + '      },\n'
      + '    ],\n'
      + '  },\n'
      + '})\n'
      + '```',
    commands:
      '执行时只使用这些命令\n'
      + '- agent-task workspace <id>\n'
      + '- agent-task status <id> in_progress\n'
      + '- agent-task status <id> done',
    repairGuidance:
      '续作说明\n'
      + '这个任务已经执行过一次，但上一次执行超时，当前尚未完成。你需要基于当前 workspace 和已有产物继续完成，优先复用已有文件和中间结果，不要无故从头开始。\n'
      + '续作时请优先遵循：先检查已有产物和中间文件，优先续做，不要无故从头开始。',
  },
  strategies: cloneDefaultTaskTypes(),
};

export const DEFAULT_CHAT_GUIDANCE = {
  template: DEFAULT_CHAT_TEMPLATE,
  whenToCreate:
    '什么时候应该创建任务：\n'
    + '当工作需要脱离当前对话持续推进、会产生文件交付物，或者后续需要回看时，就应该创建任务。',
  defaultScenarios:
    '默认应立即创建任务的情况：\n'
    + '- 会产出报告、代码、网页、音频或其他文件。\n'
    + '- 任务可能需要多轮修改，或者后续会收到人类反馈。\n'
    + '- 需要把 AI 做过的过程和结果沉淀到独立 workspace 中。',
  confirmScenarios:
    '可能需要先确认再创建的情况：\n'
    + '- 用户只是做即时问答，暂时没有交付物。\n'
    + '- 用户还在讨论方向，尚未决定是否进入执行。',
};

function buildExecutionGuidanceDefaults() {
  const templates = readDefaultPromptTemplates();

  return {
    ...structuredClone(DEFAULT_EXECUTION_GUIDANCE),
    template: templates.execution,
  };
}

function buildChatGuidanceDefaults() {
  const templates = readDefaultPromptTemplates();

  return {
    ...structuredClone(DEFAULT_CHAT_GUIDANCE),
    template: templates.chat,
  };
}

export function cloneDefaultGuidance() {
  return {
    general: structuredClone(DEFAULT_GENERAL_CONFIG),
    executionGuidance: buildExecutionGuidanceDefaults(),
    chatGuidance: buildChatGuidanceDefaults(),
  };
}
