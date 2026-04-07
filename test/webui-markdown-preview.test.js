import { describe, expect, it } from 'vitest';
import { markdownToPlainTextPreview } from '../lib/webui/client/src/lib/markdown-preview.js';

describe('markdownToPlainTextPreview', () => {
  it('keeps readable plain text and preserves line breaks', () => {
    const input = [
      '## 核心问题',
      '',
      '- 第一条',
      '- 第二条',
      '',
      '> 引用内容',
      '',
      '带 **粗体**、*斜体* 和 `代码` 的句子。',
    ].join('\n');

    expect(markdownToPlainTextPreview(input)).toBe([
      '核心问题',
      '',
      '- 第一条',
      '- 第二条',
      '',
      '引用内容',
      '',
      '带 粗体、斜体 和 代码 的句子。',
    ].join('\n'));
  });

  it('prefers link text over raw markdown link syntax', () => {
    const input = '查看 [原文链接](https://example.com/article) 获取详情';

    expect(markdownToPlainTextPreview(input)).toBe('查看 原文链接 获取详情');
  });
});
