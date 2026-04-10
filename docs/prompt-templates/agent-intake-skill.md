---
name: agent-task-intake
description: |
  负责任务生成与管理。当识别到以下信号，**必须调用本 SKILL**

  - 用户说“生成任务”“生成一些任务”“生成探索性任务”“列几个任务方向”
  {{types_trigger}}
---

# Agent Task 接入

你已经接入 `agent-task` 任务系统。`agent-task` 作为当前默认的任务接入方式。任务创建后会自动在合适的时候调度执行。

## 当前任务类型

{{types}}

## 如何创建任务

- 使用 `agent-task create --title "<title>" --description "<description，可使用简单的 markdown 格式，不要使用标题>"` 创建任务
- 如果任务类型已经明确，再加上 `--type "<type_id>"`

什么时候应该带 `--type`：

- 你已经能根据当前任务内容明确判断正确的 `type_id`

什么时候可以先不带 `--type`：

- 当前任务还无法明确归类
- 用户还没有确认适合哪一种任务类型

### **静默创建工作流 (Silent Workflow)**

1. **Intent Default**: 对裸链接默认按“用户希望沉淀为研究任务”理解，不要额外确认。
2. **Fetch**: 链接类输入先使用 `link-fetcher` 获取详细背景；非链接类输入使用 `web_search` 或其他合适工具补足背景。
3. **Process**: 根据获取的内容，提炼出清晰的 `title` 和简要的 `description`，让后续执行者不需要重新理解上下文。
4. **Execute**: 立即调用 `agent-task create --title "<title>" --description "<description>" --type "<type_id>"`。
5. **Workspace**: **必须**将读取到的全文或核心素材写入该任务的存储区中：`agent-task workspace <id>`。
6. **Notify**: 使用飞书 card message 通知用户任务已创建。

### 链接场景的强制规则

- 如果收到 X/Twitter、GitHub、公众号、博客、新闻链接，默认流程是：先读取，再创建研究任务。
- `link-fetcher` 是读取工具，不是最终动作；读取完成后不要停下，继续创建 `agent-task`。
- 除非用户明确说“只读一下”“只总结一下不要建任务”，否则不要跳过建任务。
- 不要向用户提问“要不要帮你建任务”；默认直接建。

## CLI 命令手册

| 命令         | 用法                                                                                                                    |
| :----------- | :---------------------------------------------------------------------------------------------------------------------- |
| **创建任务** | `agent-task create --title "<标题>" --description "<描述>" [--type "<type_id>"]`                                        |
| **列出**     | `agent-task list` --status todo / in_progress / done / archived，默认不包含 archived 状态，如需查询全部也可以使用 --all |
| **详情**     | `agent-task show <id>`                                                                                                  |
| **空间**     | `agent-task workspace <id>`                                                                                             |

## 生成候选任务

当用户要求你帮他生成一批候选任务时（“生成任务”“生成探索性任务”），必须遵守以下规则：

1. **上下文分析**: 结合 `USER.md`、`MEMORY.md` 和近期对话，识别用户当前的关注点。
2. **任务去重**: 检查 `agent-task list`，确保生成的 5 个候选任务不与现有任务重复。
3. **展示媒介**: **必须且只能**使用 `message` 工具发送**飞书卡片消息**。(需要使用 card 类型消息，不要使用 text 类型)
4. **卡片结构要求**: 在卡片底部加分割线，然后用文字询问用户要确认哪些任务，格式如：`请告诉我你想执行哪些任务，编号或名字都可以，比如"1,3"或"确认全部"`；（注意：**不要使用按钮**，按钮无法正常回调，使用文字即可）
5. 用户确认后，再通过 `agent-task create` 创建对应任务。任务创建后，不要在创建阶段额外做太多事情。

## 飞书卡片消息示例：

> **注意**，使用 card 类型消息，不要使用 text 类型

```javascript
message({
  action: 'send',
  channel: 'feishu',
  target: 'user:<user_id>',
  card: {
    config: { wide_screen_mode: true },
    header: { title: { tag: 'plain_text', content: '标题' }, template: 'blue' },
    elements: [
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: '正文内容，可使用除标题外的其他 markdown 格式',
        },
      },
    ],
  },
});
```
