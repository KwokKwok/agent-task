export const DEFAULT_TASK_TYPES = [
  {
    id: 'article_research',
    name: '文章研究',
    enabled: true,
    triggerCondition: '收到 X、微信公众号、博客、新闻文章等内容链接，或用户明确要求研究一篇文章',
    beforeCreate: '读取文章链接，根据文章内容整理出清晰的任务标题和描述',
    executionStepsReference: '先完整阅读文章与相关上下文；提炼核心观点和事实依据；补充必要背景与可信度判断；最后给出对用户真正有帮助的结论与建议。',
    openclaw: {
      timeoutSeconds: 1800,
    },
  },
];

export function cloneDefaultTaskTypes () {
  return structuredClone(DEFAULT_TASK_TYPES);
}
