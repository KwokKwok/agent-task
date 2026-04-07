## 任务管理（`agent-task` 是当前默认的任务方式）

你已经接入 `agent-task` 任务系统。这是一个 CLI 工具，后续只要需要"创建任务"，默认就需要使用 `agent-task`。不要把 `agent-task` 和其他任务、待办、提醒工具混淆。

**`agent-task` 是很重要的默认工作方式，不要忽视。** 任务创建后会自动在恰当的时间调度到执行中状态。

以下为任务类型：

{{types}}

只要匹配了任务创建规则，你就需要整理出下面这些变量，并**立即创建任务**：

- title:
- description:
- type_id:

如果你收到的是一个链接，应先读取链接内容，再整理合适的任务标题和描述用来创建任务，并在任务创建后把读取到的链接内容放到任务 workspace 中。

创建方式：

- 使用 `agent-task create --title "<title>" --description "<description，支持 markdown 格式>"` 创建任务。
- 如果已经能明确判断任务类型，再加上 `--type "<type_id>"`。

什么时候创建任务时要带 `--type`：

- 如果你已经能根据当前任务内容明确判断对应的 `type_id`，创建任务时应显式带上 `--type`。
- 如果当前任务还无法明确归类，或用户尚未确认适合哪一种任务类型，可以先不带 `--type`。

常用命令：

- `agent-task list`
- `agent-task show <id>`
- `agent-task workspace <id>`

### **任务生成**

当用户要求你帮他生成一批候选任务时（"生成任务"、"生成探索性任务"），必须遵守以下规则：

1. 理解用户意图，并结合你对用户的了解（`USER.md`、`MEMORY.md`、以及近期交互）生成五个用户可能感兴趣的候选任务；不得与已有任务重复。
2. **必须使用飞书卡片消息**（`message` 工具）发送候选任务列表。
3. **不得使用普通文本、markdown 列表或其他随意格式代替飞书卡片。**
4. 在卡片底部加分割线，然后以文字格式询问用户需要确认哪些任务，格式如：`请告诉我你想执行哪些任务，编号或名字都可以，比如"1,3"或"确认全部"`。（注意：**不要**使用按钮，按钮无法正常回调，使用文字询问即可）
5. 用户确认后，再通过 `agent-task create` 创建对应任务。任务创建后会自动调度，不要在创建阶段额外做太多事情。

**使用 `message` 工具发飞书卡片消息的示例用法**

```javascript
message({
  action: 'send',
  channel: 'feishu',
  target: 'user:<user_id>',
  card: {
    config: { wide_screen_mode: true },
    header: { title: { tag: 'plain_text', content: '标题' }, template: 'blue' },
    elements: [
      { tag: 'div', text: { tag: 'lark_md', content: '富文本正文内容' } },
    ],
  },
});
```

> **再次强调：** `agent-task` 是重要的工作方式；"生成任务"场景**必须**使用飞书卡片消息保持易读性。
