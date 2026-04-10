import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resetDb } from '../lib/db.js';
import {
  clearPublicUrl,
  getBindConfig,
  getPublicUrl,
  readWebuiConfig,
  setPublicUrl,
  setWebuiConfig,
} from '../lib/webui/config-store.js';

let tmpDir;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'agent-task-webui-config-'));
  process.env.AGENT_TASK_HOME = tmpDir;
});

afterEach(() => {
  resetDb();
  rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.AGENT_TASK_HOME;
});

describe('webui config store', () => {
  it('normalizes and persists public URL', () => {
    const v = setPublicUrl('task.example.com/');
    expect(v).toBe('https://task.example.com');
    expect(getPublicUrl()).toBe('https://task.example.com');
  });

  it('can clear public URL', () => {
    setPublicUrl('https://task.example.com');
    clearPublicUrl();
    expect(getPublicUrl()).toBeNull();
  });

  it('supports bind host/port config and clear', () => {
    setWebuiConfig({ host: '0.0.0.0', port: 3333 });
    const cfg = getBindConfig('127.0.0.1', 3333);
    expect(cfg.host).toBe('0.0.0.0');
    expect(cfg.port).toBe(3333);

    setWebuiConfig({ host: null, port: null });
    const fallback = getBindConfig('127.0.0.1', 3333);
    expect(fallback.host).toBe('127.0.0.1');
    expect(fallback.port).toBe(3333);
  });

  it('keeps public URL separate from bind host and port', () => {
    setWebuiConfig({ publicUrl: 'https://task.example.com' });

    const cfg = getBindConfig('127.0.0.1', 3333);

    expect(cfg.host).toBe('127.0.0.1');
    expect(cfg.port).toBe(3333);
    expect(getPublicUrl()).toBe('https://task.example.com');
  });

  it('rejects invalid bind ports', () => {
    expect(() => setWebuiConfig({ port: 0 })).toThrow('Invalid port');
    expect(() => setWebuiConfig({ port: 65536 })).toThrow('Invalid port');
    expect(() => setWebuiConfig({ port: 'abc' })).toThrow('Invalid port');
  });

  it('returns default execution guidance when config file is empty', () => {
    const config = readWebuiConfig();

    expect(config.general.openclawDefaults.timeoutSeconds).toBe(1800);
    expect(config.general.openclawDefaults.thinking).toBe('off');
    expect(config.chatGuidance.template).toBe(
      readFileSync(join(process.cwd(), 'docs/prompt-templates/agent-intake-skill.md'), 'utf-8').trim(),
    );
    expect(config.executionGuidance.template).toBe(
      readFileSync(join(process.cwd(), 'docs/prompt-templates/agent-execution.md'), 'utf-8').trim(),
    );
    expect(config.executionGuidance.common.executionApproach).toBeTruthy();
    expect(config.executionGuidance.strategies.length).toBeGreaterThan(0);
  });

  it('persists execution guidance and strategy timeout settings', () => {
    const updated = setWebuiConfig({
      general: {
        openclawDefaults: {
          thinking: 'minimal',
          timeoutSeconds: 2100,
        },
      },
      executionGuidance: {
        common: {
          executionApproach: '先进入 workspace，再读取 feedback。',
          repairGuidance: '超时后优先续做，不要重头开始。',
        },
        strategies: [
          {
            id: 'article_research',
            name: '文章研究',
            triggerCondition: '收到文章链接',
            beforeCreate: '创建文章研究任务',
            executionStepsReference: '阅读并总结',
            openclaw: { timeoutSeconds: 2400 },
          },
        ],
      },
    });

    expect(updated.general.openclawDefaults.timeoutSeconds).toBe(2100);
    expect(updated.general.openclawDefaults.thinking).toBe('minimal');
    expect(updated.executionGuidance.common.executionApproach).toBe('先进入 workspace，再读取 feedback。');
    expect(updated.executionGuidance.common.repairGuidance).toBe('超时后优先续做，不要重头开始。');
    expect(updated.executionGuidance.strategies[0].openclaw.timeoutSeconds).toBe(2400);
    expect(updated.executionGuidance.strategies[0].executionStepsReference).toBe('阅读并总结');
    expect(readWebuiConfig().executionGuidance.strategies[0].openclaw.timeoutSeconds).toBe(2400);
  });
});
