import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resetDb } from '../lib/db.js';
import { setWebuiConfig } from '../lib/webui/config-store.js';
import {
  createTaskType,
  formatTaskTypesMarkdown,
  listTaskTypes,
  updateTaskType,
} from '../lib/task-type.js';

let tmpDir;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'agent-task-type-'));
  process.env.AGENT_TASK_HOME = tmpDir;
});

afterEach(() => {
  resetDb();
  rmSync(tmpDir, { recursive: true, force: true });
  delete process.env.AGENT_TASK_HOME;
});

describe('task type store', () => {
  it('preserves disabled task types when creating a new type', () => {
    setWebuiConfig({
      executionGuidance: {
        strategies: [
          {
            id: 'article_research',
            name: '文章研究',
            enabled: true,
            triggerCondition: '收到文章链接',
            beforeCreate: '先读文章',
            executionStepsReference: '总结观点',
            openclaw: { timeoutSeconds: 1800 },
          },
          {
            id: 'book_research',
            name: '书籍研究',
            enabled: false,
            triggerCondition: '收到书名',
            beforeCreate: '先确认书名和作者',
            executionStepsReference: '梳理全书结构',
            openclaw: { timeoutSeconds: 2400 },
          },
        ],
      },
    });

    createTaskType({
      id: 'podcast_research',
      name: '播客研究',
      triggerCondition: '收到播客链接',
      beforeCreate: '先转录并确认节目主题',
      executionStepsReference: '提炼主要观点',
      timeoutSeconds: 2000,
    });

    const allTypes = listTaskTypes(null, { includeDisabled: true });
    expect(allTypes.map((item) => item.id)).toEqual([
      'article_research',
      'book_research',
      'podcast_research',
    ]);
    expect(allTypes.find((item) => item.id === 'book_research')?.enabled).toBe(false);
  });

  it('updates disabled task types without dropping them from config', () => {
    setWebuiConfig({
      executionGuidance: {
        strategies: [
          {
            id: 'article_research',
            name: '文章研究',
            enabled: true,
            triggerCondition: '收到文章链接',
            beforeCreate: '先读文章',
            executionStepsReference: '总结观点',
            openclaw: { timeoutSeconds: 1800 },
          },
          {
            id: 'book_research',
            name: '书籍研究',
            enabled: false,
            triggerCondition: '收到书名',
            beforeCreate: '先确认书名和作者',
            executionStepsReference: '梳理全书结构',
            openclaw: { timeoutSeconds: 2400 },
          },
        ],
      },
    });

    updateTaskType('book_research', {
      name: '书籍研究增强版',
      timeoutSeconds: 2600,
    });

    const allTypes = listTaskTypes(null, { includeDisabled: true });
    expect(allTypes).toHaveLength(2);
    expect(allTypes.find((item) => item.id === 'book_research')).toMatchObject({
      id: 'book_research',
      name: '书籍研究增强版',
      enabled: false,
      openclaw: { timeoutSeconds: 2600 },
    });
  });

  it('omits empty task type fields when exporting markdown', () => {
    const markdown = formatTaskTypesMarkdown([
      {
        id: 'article_research',
        name: '文章研究',
        triggerCondition: '',
        beforeCreate: '',
        executionStepsReference: '',
        openclaw: { timeoutSeconds: 1800 },
      },
    ]);

    expect(markdown).toContain('## 文章研究 (article_research)');
    expect(markdown).toContain('- type_id: article_research');
    expect(markdown).toContain('- 默认超时: 1800s');
    expect(markdown).not.toContain('未填写');
    expect(markdown).not.toContain('适用场景:');
    expect(markdown).not.toContain('创建任务前先做什么:');
    expect(markdown).not.toContain('执行参考:');
  });
});
