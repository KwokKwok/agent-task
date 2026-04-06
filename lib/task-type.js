import { cloneDefaultTaskTypes } from './defaults/task-types.js';
import { readWebuiConfig, setWebuiConfig } from './webui/config-store.js';

function normalizeTypeId(value) {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeTimeoutSeconds(value, fallback = 1800) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const timeoutSeconds = Number(value);
  if (!Number.isInteger(timeoutSeconds) || timeoutSeconds <= 0) {
    throw new Error(`Invalid timeout: ${value}`);
  }
  return timeoutSeconds;
}

function normalizeTaskTypePayload(input = {}, { requireId = true, requireName = true } = {}) {
  const id = normalizeTypeId(input.id);
  const name = normalizeText(input.name);

  if (requireId && !id) {
    throw new Error('Task type id is required');
  }
  if (requireName && !name) {
    throw new Error(`Task type name is required${id ? ` for ${id}` : ''}`);
  }

  return {
    ...(id ? { id } : {}),
    ...(name ? { name } : {}),
    ...(input.enabled !== undefined ? { enabled: input.enabled !== false } : {}),
    ...(input.triggerCondition !== undefined ? { triggerCondition: normalizeText(input.triggerCondition) } : {}),
    ...(input.beforeCreate !== undefined ? { beforeCreate: normalizeText(input.beforeCreate) } : {}),
    ...(input.executionStepsReference !== undefined ? { executionStepsReference: normalizeText(input.executionStepsReference) } : {}),
    ...(input.timeoutSeconds !== undefined
      ? {
          openclaw: {
            timeoutSeconds: normalizeTimeoutSeconds(input.timeoutSeconds),
          },
        }
      : {}),
  };
}

export function listTaskTypes(config = null, { includeDisabled = false } = {}) {
  const resolvedConfig = config || readWebuiConfig();
  const configured = resolvedConfig?.executionGuidance?.strategies;
  const items = Array.isArray(configured)
    ? configured.map((item) => ({ ...item }))
    : cloneDefaultTaskTypes();
  return includeDisabled ? items : items.filter((item) => item.enabled !== false);
}

export function getTaskTypeById(typeId, config = null, { includeDisabled = true } = {}) {
  const normalizedTypeId = normalizeTypeId(typeId);
  if (!normalizedTypeId) return null;
  return listTaskTypes(config, { includeDisabled }).find((item) => item.id === normalizedTypeId) || null;
}

export function ensureValidTaskTypeId(typeId, config = null, { allowDisabled = false } = {}) {
  const normalizedTypeId = normalizeTypeId(typeId);
  if (!normalizedTypeId) return null;

  const match = getTaskTypeById(normalizedTypeId, config, { includeDisabled: allowDisabled });
  if (match) {
    return match.id;
  }

  const available = listTaskTypes(config, { includeDisabled: allowDisabled }).map((item) => item.id).join(', ');
  throw new Error(`Invalid type_id: ${normalizedTypeId}${available ? `. Available: ${available}` : ''}`);
}

export function formatTaskTypesMarkdown(types) {
  const items = (types || []).filter(Boolean);
  if (!items.length) {
    return '# 任务类型\n\n当前没有可用的任务类型。';
  }

  const lines = [
    '# 任务类型',
    '',
    '以下是当前可用的全部任务类型。创建任务时，如果已经能判断类型，请显式填写 `type_id`。',
  ];

  for (const item of items) {
    lines.push('');
    lines.push(`## ${item.name} (${item.id})`);
    lines.push(`- type_id: ${item.id}`);
    if (item.triggerCondition) {
      lines.push(`- 适用场景: ${item.triggerCondition}`);
    }
    if (item.beforeCreate) {
      lines.push(`- 创建任务前先做什么: ${item.beforeCreate}`);
    }
    if (item.executionStepsReference) {
      lines.push(`- 执行参考: ${item.executionStepsReference}`);
    }
    lines.push(`- 默认超时: ${item.openclaw?.timeoutSeconds || 1800}s`);
  }

  return lines.join('\n');
}

export function createTaskType(input = {}) {
  const config = readWebuiConfig();
  const currentTypes = listTaskTypes(config, { includeDisabled: true });
  const nextType = normalizeTaskTypePayload(input, { requireId: true, requireName: true });

  if (currentTypes.some((item) => item.id === nextType.id)) {
    throw new Error(`Task type already exists: ${nextType.id}`);
  }

  setWebuiConfig({
    executionGuidance: {
      strategies: [...currentTypes, nextType],
    },
  });

  return getTaskTypeById(nextType.id, null, { includeDisabled: true });
}

export function updateTaskType(typeId, patch = {}) {
  const normalizedTypeId = ensureValidTaskTypeId(typeId, null, { allowDisabled: true });
  const config = readWebuiConfig();
  const currentTypes = listTaskTypes(config, { includeDisabled: true });
  const currentType = currentTypes.find((item) => item.id === normalizedTypeId);
  const normalizedPatch = normalizeTaskTypePayload(patch, { requireId: false, requireName: false });

  if ('id' in normalizedPatch && normalizedPatch.id !== normalizedTypeId) {
    throw new Error('Task type id cannot be changed');
  }

  const nextTypes = currentTypes.map((item) => {
    if (item.id !== normalizedTypeId) {
      return item;
    }

    return {
      ...item,
      ...normalizedPatch,
      openclaw: {
        ...(item.openclaw || {}),
        ...(normalizedPatch.openclaw || {}),
      },
    };
  });

  const nextType = nextTypes.find((item) => item.id === normalizedTypeId) || currentType;
  if (!nextType?.name) {
    throw new Error(`Task type name is required for ${normalizedTypeId}`);
  }

  setWebuiConfig({
    executionGuidance: {
      strategies: nextTypes,
    },
  });

  return getTaskTypeById(normalizedTypeId, null, { includeDisabled: true });
}
