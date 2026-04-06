请执行任务 {{task.id}}。

{{#if repair}}

## 执行情况说明

这个任务之前已经执行过，但上一次执行超时，当前尚未完成。你需要基于当前 workspace 和已有产物继续完成，优先复用已有文件和中间结果，不要无故从头开始。
{{/if}}

## 任务信息

- Title: {{task.title}}
- Task ID: {{task.id}}
- Type ID: {{task.type_id}}
- Workspace: {{task.workspace_path}}
- Session Key: {{runtime.sessionKey}}
- Timeout: {{runtime.timeoutSeconds}}s
- Description: {{task.description}}

## 执行要求

1. 在当前 workspace 产出临时文件、脚本、计划等中间文件，最后**必须**生成 report.md、report.html、report.mp3（_建议 3 分钟左右_）
2. 任务完成后**必须**使用 `agent-task status {{task.id}} done` 将任务标记完成。并通过 `agent-task webui links {{task.id}}` 获取产物链接，如果当前环境接入了飞书，则**必须**通过 `message` 工具发飞书卡片消息给用户（green 主题，需要包含两个按钮：查看网页报告、查看文字报告，标题和按钮都不需要 emoji，发送方式参考下方示例用法）。
3. **重要：任务执行过程中不要主动汇报中间状态，除非用户明确要求；同时避免重复通知。** 如果需要调用 sessions_spawn，必须设置 expectsCompletionMessage: false。

**使用 `message` 工具发卡片的示例用法**

```javascript
message({
  action: 'send',
  channel: 'feishu',
  target: 'user:<user_id>',
  card: {
    config: { wide_screen_mode: true },
    header: { title: { tag: 'plain_text', content: '标题' }, template: 'blue' },
    elements: [
      { tag: 'div', text: { tag: 'lark_md', content: '正文内容' } },
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '按钮' },
            type: 'primary',
            url: 'https://example-link.com',
          },
        ],
      },
    ],
  },
});
```

### 执行类型参考

{{#if hasTaskType}}
当前任务已匹配到 `{{task.type_id}}`。请优先按这个任务类型执行；如果任务描述和类型参考存在冲突，再结合实际任务内容调整。
{{/if}}

{{#if missingTaskType}}
当前任务没有匹配到有效的 `type_id`。请先看下面这些执行类型参考，再结合任务内容自行判断应优先按哪一种执行。
{{/if}}

{{types}}

{{#if hasFeedback}}

## 返工说明

这个任务之前已经执行过，用户现在给了新的反馈。你需要基于当前 workspace 和已有交付物继续调整，不要把它当成新任务重做。

用户反馈：
{{feedback.latestHuman.message}}

完成调整后，请使用 AI 反馈命令记录本次修改说明：
agent-task feedback update {{task.id}} --message "..." --backup
{{/if}}
