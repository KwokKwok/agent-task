import { getBaseDir } from './db.js';
import {
  DEFAULT_CHAT_TEMPLATE,
  DEFAULT_EXECUTION_TEMPLATE,
} from './defaults/agent-guidance.js';
import { getTaskTypeById, listTaskTypes } from './task-type.js';

const DEFAULT_MOCK_TIMEOUT_SECONDS = 1800;

function formatTaskTypeLine(item, index) {
  const trigger = String(item?.triggerCondition ?? '').trim();
  return trigger
    ? `${index + 1}. ${item.name}（触发：${trigger}）`
    : `${index + 1}. ${item.name}`;
}

function formatExecutionTypeText(taskTypes) {
  if (!taskTypes.length) return '当前没有额外任务类型参考。';
  return taskTypes
    .map((item, index) => {
      const lines = [`${index + 1}. ${item.name}`];
      if (item.triggerCondition) {
        lines.push(`- 适用场景：${item.triggerCondition}`);
      }
      if (item.beforeCreate) {
        lines.push(`- 创建任务前先做什么：${item.beforeCreate}`);
      }
      if (item.executionStepsReference) {
        lines.push(`- 处理方式：${item.executionStepsReference}`);
      }
      return lines.join('\n');
    })
    .join('\n');
}

function formatOnboardingTriggerText(taskTypes) {
  const lines = (taskTypes || [])
    .map((item) => String(item?.triggerCondition ?? '').trim())
    .filter(Boolean)
    .map((trigger) => `- ${trigger}`);

  if (!lines.length) {
    return '- 当前没有可用任务类型触发条件';
  }

  return lines.join('\n');
}

function formatOnboardingTypesTable(taskTypes) {
  if (!taskTypes.length) return '';

  const header = '| type_id | 任务名称 | 触发方式 | 创建任务前需要做什么 |\n|---------|----------|----------|---------------------|';
  const rows = taskTypes.map((item) => {
    const trigger = (item.triggerCondition || '').replace(/\|/g, '\\|');
    const before = (item.beforeCreate || '').replace(/\|/g, '\\|');
    return `| ${item.id} | ${item.name} | ${trigger} | ${before} |`;
  });

  return [header, ...rows].join('\n');
}

function resolvePromptTaskTypes(task, config) {
  const matchedTaskType = task?.type_id
    ? getTaskTypeById(task.type_id, config, { includeDisabled: true })
    : null;

  return {
    matchedTaskType,
    taskTypes: matchedTaskType ? [matchedTaskType] : listTaskTypes(config),
  };
}

function normalizeTemplate(value, fallback) {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function getChatTemplate(config) {
  return normalizeTemplate(config?.chatGuidance?.template, DEFAULT_CHAT_TEMPLATE);
}

function getExecutionTemplate(config) {
  return normalizeTemplate(config?.executionGuidance?.template, DEFAULT_EXECUTION_TEMPLATE);
}

function getMockTask(dataRoot = getBaseDir()) {
  return {
    id: 'demo-1234',
    title: '整理一篇文章研究报告',
    description: '阅读用户提供的文章，提炼核心观点、可信度判断和可执行建议，并产出完整报告。',
    type_id: '',
    workspace_path: `${dataRoot}/tasks/demo-1234`,
    timeout_seconds: DEFAULT_MOCK_TIMEOUT_SECONDS,
  };
}

function getMockFeedback() {
  return {
    items: [
      {
        actor: 'human',
        kind: 'comment',
        message: '请补充证据来源，并把结论写得更具体一些。',
        created_at: '2026-04-04T12:00:00.000Z',
      },
    ],
  };
}

function joinSections(sections) {
  return sections
    .filter(Boolean)
    .map((section) => Array.isArray(section) ? section.join('\n') : section)
    .join('\n\n');
}

function getValueByPath(source, path) {
  return String(path || '')
    .split('.')
    .filter(Boolean)
    .reduce((current, key) => (current == null ? undefined : current[key]), source);
}

function renderValue(value) {
  if (value == null) return '';
  if (Array.isArray(value)) return value.join('\n');
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

function renderTemplate(template, context) {
  const source = String(template ?? '').replace(/\r\n/g, '\n');

  function renderConditionals(input) {
    return input.replace(/{{#if\s+([\w.]+)}}([\s\S]*?){{\/if}}/g, (_match, path, inner) => {
      const value = getValueByPath(context, path);
      return value ? renderConditionals(inner) : '';
    });
  }

  return renderConditionals(source)
    .replace(/^([ \t]*){{\s*([\w.]+)\s*}}[ \t]*$/gm, (_match, indent, path) => {
      const value = renderValue(getValueByPath(context, path));
      if (!value) return '';
      return value.split('\n').map((line) => indent + line).join('\n');
    })
    .replace(/{{\s*([\w.]+)\s*}}/g, (_match, path) => renderValue(getValueByPath(context, path)))
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function findLatestHumanFeedback(feedback) {
  if (!Array.isArray(feedback?.items)) return null;
  return [...feedback.items].reverse().find((item) => item.actor === 'human') || null;
}

function normalizeTask(task, dataRoot = getBaseDir()) {
  const source = task || getMockTask(dataRoot);
  return {
    id: source.id || 'demo-1234',
    title: source.title || 'Untitled Task',
    description: source.description || '(none)',
    type_id: source.type_id || '',
    workspace_path: source.workspace_path || `${dataRoot}/tasks/${source.id || 'demo-1234'}`,
    timeout_seconds: Number(source.timeout_seconds) > 0
      ? Number(source.timeout_seconds)
      : DEFAULT_MOCK_TIMEOUT_SECONDS,
  };
}

function buildTemplateContext({
  config,
  dataRoot = getBaseDir(),
  task,
  templateType = 'execution',
  mode = 'dispatch',
  sessionKey,
  timeoutSeconds,
  feedback,
  hasFeedback = false,
}) {
  const normalizedTask = normalizeTask(task, dataRoot);
  const latestHumanFeedback = findLatestHumanFeedback(feedback)
    || (hasFeedback ? findLatestHumanFeedback(getMockFeedback()) : null);
  const { matchedTaskType, taskTypes } = resolvePromptTaskTypes(normalizedTask, config);
  const hasTaskType = Boolean(matchedTaskType);

  return {
    dataRoot,
    task: normalizedTask,
    runtime: {
      mode: mode === 'repair' ? 'repair' : 'dispatch',
      sessionKey: sessionKey || `task-${normalizedTask.id}`,
      timeoutSeconds: Number(timeoutSeconds) > 0
        ? Number(timeoutSeconds)
        : normalizedTask.timeout_seconds,
    },
    types: templateType === 'chat'
      ? formatOnboardingTypesTable(taskTypes)
      : formatExecutionTypeText(taskTypes),
    types_trigger: formatOnboardingTriggerText(taskTypes),
    tasks_trigger: formatOnboardingTriggerText(taskTypes),
    feedback: {
      latestHuman: latestHumanFeedback
        ? {
            message: latestHumanFeedback.message || '',
            created_at: latestHumanFeedback.created_at || '',
          }
        : {
            message: '',
            created_at: '',
          },
    },
    repair: mode === 'repair',
    hasTaskType,
    missingTaskType: !hasTaskType,
    hasFeedback: Boolean(latestHumanFeedback),
    hasTask: Boolean(normalizedTask),
  };
}

function buildTemplateDocs(type) {
  const lines = [
    '可用变量',
    '- {{dataRoot}}',
    '- {{task.id}}',
    '- {{task.title}}',
    '- {{task.description}}',
    '- {{task.type_id}}',
    '- {{task.workspace_path}}',
    '- {{runtime.mode}}',
    '- {{runtime.sessionKey}}',
    '- {{runtime.timeoutSeconds}}',
  ];

  lines.push('- {{types}}');
  if (type === 'chat') {
    lines.push('- {{types_trigger}}');
    lines.push('- {{tasks_trigger}}');
  }

  if (type === 'execution') {
    lines.push('- {{feedback.latestHuman.message}}');
  }

  lines.push('');
  lines.push('可用条件');
  lines.push('- {{#if repair}} ... {{/if}}');
  lines.push('- {{#if hasFeedback}} ... {{/if}}');
  lines.push('- {{#if hasTask}} ... {{/if}}');
  lines.push('- {{#if task.type_id}} ... {{/if}}');
  lines.push('- {{#if hasTaskType}} ... {{/if}}');
  lines.push('- {{#if missingTaskType}} ... {{/if}}');

  return lines.join('\n');
}

export function buildPromptSections({
  type,
  config,
  dataRoot = getBaseDir(),
  task = null,
  mode = 'dispatch',
  feedback = null,
  hasFeedback = false,
}) {
  const isChat = type === 'chat';
  const template = isChat ? getChatTemplate(config) : getExecutionTemplate(config);
  const preview = isChat
    ? buildChatAgentPrompt({ config, dataRoot, task })
    : buildExecutionReferencePrompt({ config, dataRoot, task, mode, feedback, hasFeedback });

  const sections = [
    {
      id: 'template',
      title: isChat ? '聊天引导模板' : '执行提示词模板',
      content: template,
      editable: true,
      configPath: isChat ? 'chatGuidance.template' : 'executionGuidance.template',
    },
    {
      id: 'docs',
      title: '模板变量与条件',
      content: buildTemplateDocs(isChat ? 'chat' : 'execution'),
      editable: false,
    },
  ];

  if (!isChat) {
    sections.push({
      id: 'types',
      title: '任务类型执行参考',
      content: formatExecutionTypeText(listTaskTypes(config)),
      editable: true,
      isTaskType: true,
    });
  }

  return { sections, fullText: preview };
}

export function buildChatAgentPrompt({
  config,
  dataRoot = getBaseDir(),
  task = null,
}) {
  const template = getChatTemplate(config);
  const context = buildTemplateContext({ config, dataRoot, task, templateType: 'chat' });
  return renderTemplate(template, context);
}

export function buildExecutionReferencePrompt({
  config,
  dataRoot = getBaseDir(),
  task = null,
  mode = 'dispatch',
  feedback = null,
  hasFeedback = false,
}) {
  const template = getExecutionTemplate(config);
  const context = buildTemplateContext({
    config,
    dataRoot,
    task,
    templateType: 'execution',
    mode,
    feedback,
    hasFeedback,
  });

  return renderTemplate(template, context);
}

export function buildExecutionPrompt({
  task,
  config,
  mode = 'dispatch',
  sessionKey,
  timeoutSeconds,
  feedback,
  dataRoot = getBaseDir(),
}) {
  const template = getExecutionTemplate(config);
  const context = buildTemplateContext({
    config,
    dataRoot,
    task,
    templateType: 'execution',
    mode,
    sessionKey,
    timeoutSeconds,
    feedback,
  });

  return renderTemplate(template, context);
}

export function buildPromptPreview({
  type,
  config,
  dataRoot = getBaseDir(),
  task = null,
  mode = 'dispatch',
  feedback = null,
  hasFeedback = false,
}) {
  if (type === 'chat') {
    return buildChatAgentPrompt({ config, dataRoot, task });
  }

  return buildExecutionReferencePrompt({
    config,
    dataRoot,
    task,
    mode,
    feedback,
    hasFeedback,
  });
}

export function getPromptPreviewData({
  dataRoot = getBaseDir(),
  task = null,
  feedback = null,
  useMockTask = false,
  hasFeedback = false,
}) {
  const resolvedTask = useMockTask || !task ? getMockTask(dataRoot) : normalizeTask(task, dataRoot);
  const resolvedFeedback = hasFeedback
    ? (findLatestHumanFeedback(feedback) ? feedback : getMockFeedback())
    : null;

  return {
    task: resolvedTask,
    feedback: resolvedFeedback,
  };
}

export function buildStrategySummary(strategies) {
  return joinSections([
    '任务类型参考：',
    ...(strategies || []).map(formatTaskTypeLine),
  ]);
}
