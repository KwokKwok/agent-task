import { readProjectJson, writeProjectJson } from './json-store.js';
import { cloneDefaultGuidance } from '../defaults/agent-guidance.js';

function getConfigFile() {
  return 'webui.config.json';
}

function normalizeHost(host) {
  if (!host) return null;
  const v = String(host).trim();
  return v || null;
}

function normalizePort(port) {
  if (port === undefined || port === null || port === '') return null;
  const n = Number(port);
  if (!Number.isInteger(n) || n <= 0 || n > 65535) {
    throw new Error(`Invalid port: ${port}`);
  }
  return n;
}

function normalizeTimeoutSeconds(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`Invalid timeout: ${value}`);
  }
  return n;
}

function normalizeTextBlock(value, fallback = '') {
  const v = String(value ?? '').trim();
  return v || fallback;
}

function normalizeStrategy(strategy, index, fallbackTimeoutSeconds) {
  const id = String(strategy?.id ?? '').trim();
  const name = String(strategy?.name ?? '').trim();
  if (!id) {
    throw new Error(`Invalid strategy id at index ${index}`);
  }
  if (!name) {
    throw new Error(`Invalid strategy name for ${id}`);
  }

  return {
    id,
    name,
    enabled: strategy?.enabled !== false,
    triggerCondition: String(strategy?.triggerCondition ?? '').trim(),
    beforeCreate: String(strategy?.beforeCreate ?? '').trim(),
    executionStepsReference: normalizeTextBlock(strategy?.executionStepsReference, ''),
    openclaw: {
      timeoutSeconds: normalizeTimeoutSeconds(
        strategy?.openclaw?.timeoutSeconds,
        fallbackTimeoutSeconds,
      ),
    },
  };
}

function normalizePublicUrl(url) {
  if (!url) return null;
  let v = String(url).trim();
  if (!v) return null;
  if (!/^https?:\/\//i.test(v)) {
    v = `https://${v}`;
  }
  v = v.replace(/\/+$/, '');
  return v;
}

function normalizeS3Config(input = {}) {
  return {
    enabled: input.enabled === true,
    endpoint: String(input.endpoint || '').trim() || '',
    region: String(input.region || 'us-east-1').trim() || 'us-east-1',
    bucket: String(input.bucket || '').trim() || '',
    accessKeyId: String(input.accessKeyId || '').trim() || '',
    secretAccessKey: String(input.secretAccessKey || '').trim() || '',
    basePath: (() => {
      const v = String(input.basePath || '').trim();
      return v ? (v.endsWith('/') ? v : `${v}/`) : '';
    })(),
  };
}

function normalizeResourceCacheConfig(input = {}) {
  return {
    enabled: input.enabled !== false,
  };
}

function normalizeGuidanceConfig(config = {}) {
  const defaults = cloneDefaultGuidance();
  const host = normalizeHost(config.host);
  const port = normalizePort(config.port);
  const publicUrl = normalizePublicUrl(config.publicUrl);
  const defaultTimeoutSeconds = normalizeTimeoutSeconds(
    config.general?.openclawDefaults?.timeoutSeconds,
    defaults.general.openclawDefaults.timeoutSeconds,
  );

  const general = {
    openclawDefaults: {
      thinking: String(
        config.general?.openclawDefaults?.thinking
          ?? defaults.general.openclawDefaults.thinking,
      ).trim() || defaults.general.openclawDefaults.thinking,
      timeoutSeconds: defaultTimeoutSeconds,
    },
  };

  const dc = defaults.executionGuidance.common;
  const commonInput = config.executionGuidance?.common || {};
  const common = {
    executionApproach: normalizeTextBlock(commonInput.executionApproach, dc.executionApproach),
    deliverable: normalizeTextBlock(commonInput.deliverable, dc.deliverable),
    feishuCard: normalizeTextBlock(commonInput.feishuCard, dc.feishuCard),
    commands: normalizeTextBlock(commonInput.commands, dc.commands),
    repairGuidance: normalizeTextBlock(commonInput.repairGuidance, dc.repairGuidance),
  };
  const executionTemplate = normalizeTextBlock(
    config.executionGuidance?.template,
    defaults.executionGuidance.template,
  );

  const strategiesInput = Array.isArray(config.executionGuidance?.strategies)
    ? config.executionGuidance.strategies
    : defaults.executionGuidance.strategies;
  const strategies = strategiesInput.map((strategy, index) =>
    normalizeStrategy(strategy, index, defaultTimeoutSeconds));

  const cg = defaults.chatGuidance;
  const chatInput = config.chatGuidance || {};
  const chatGuidance = {
    template: normalizeTextBlock(chatInput.template, cg.template),
    whenToCreate: normalizeTextBlock(chatInput.whenToCreate, cg.whenToCreate),
    defaultScenarios: normalizeTextBlock(chatInput.defaultScenarios, cg.defaultScenarios),
    confirmScenarios: normalizeTextBlock(chatInput.confirmScenarios, cg.confirmScenarios),
  };

  const s3 = normalizeS3Config(config.s3);
  const resourceCache = normalizeResourceCacheConfig(config.resourceCache);

  return {
    ...(host ? { host } : {}),
    ...(port ? { port } : {}),
    ...(publicUrl ? { publicUrl } : {}),
    ...(config.updatedAt ? { updatedAt: config.updatedAt } : {}),
    general,
    executionGuidance: {
      template: executionTemplate,
      common,
      strategies,
    },
    chatGuidance,
    s3,
    resourceCache,
  };
}

export function readWebuiConfig() {
  return normalizeGuidanceConfig(readProjectJson(getConfigFile(), {}));
}

export function writeWebuiConfig(config) {
  writeProjectJson(getConfigFile(), config);
}

export function getPublicUrl() {
  const config = readWebuiConfig();
  return normalizePublicUrl(config.publicUrl);
}

export function setPublicUrl(url) {
  const config = readWebuiConfig();
  const value = normalizePublicUrl(url);
  writeWebuiConfig({
    ...config,
    publicUrl: value,
    updatedAt: new Date().toISOString(),
  });
  return value;
}

export function clearPublicUrl() {
  const config = readWebuiConfig();
  const next = { ...config };
  delete next.publicUrl;
  next.updatedAt = new Date().toISOString();
  writeWebuiConfig(next);
}

export function getBindConfig(defaultHost, defaultPort) {
  const cfg = readWebuiConfig();
  const host = normalizeHost(cfg.host) || defaultHost;
  const port = normalizePort(cfg.port) || defaultPort;
  return { host, port };
}

export function setWebuiConfig(input = {}) {
  const current = readWebuiConfig();
  const next = normalizeGuidanceConfig({
    ...current,
    ...input,
    host: input.host === undefined ? current.host : input.host,
    port: input.port === undefined ? current.port : input.port,
    publicUrl: input.publicUrl === undefined ? current.publicUrl : input.publicUrl,
    general: input.general
      ? {
          ...current.general,
          ...input.general,
          openclawDefaults: {
            ...current.general.openclawDefaults,
            ...(input.general.openclawDefaults || {}),
          },
        }
      : current.general,
    executionGuidance: input.executionGuidance
      ? {
          ...current.executionGuidance,
          ...input.executionGuidance,
          common: input.executionGuidance.common
            ? {
                ...current.executionGuidance.common,
                ...input.executionGuidance.common,
              }
            : current.executionGuidance.common,
          strategies: input.executionGuidance.strategies ?? current.executionGuidance.strategies,
        }
      : current.executionGuidance,
    chatGuidance: input.chatGuidance
      ? {
          ...current.chatGuidance,
          ...input.chatGuidance,
        }
      : current.chatGuidance,
    s3: input.s3 !== undefined
      ? normalizeS3Config(input.s3)
      : current.s3,
    resourceCache: input.resourceCache !== undefined
      ? normalizeResourceCacheConfig(input.resourceCache)
      : current.resourceCache,
    updatedAt: new Date().toISOString(),
  });

  writeWebuiConfig(next);
  return next;
}
