# agent-task

[![NPM version][npm-image]][npm-url]

> 搞这个东西的目的：希望让 OpenClaw 能异步的、产出结构化的东西（比如可以按需产出 markdown 报告、HTML 页面、音频播客等），并有一个 直观的 WebUI 能方便我查看。这样我看到一篇感兴趣的文章，就直接发给 OpenClaw 就行，好了我再去看分析就行。我也可以让它根据对我的了解，自己生成一些探索性的任务自己去执行。理论上也可以让它一直不停的执行任务。

`agent-task` 目前主要面向 OpenClaw 使用，不过它本质上就是个命令行工具，所以理论上哪里都能调用。

它做的事很简单：跟 AI 约定好，任务怎么创建、要怎么执行、要怎么记录中间产物和最终产出；当前默认也会通过 `openclaw agent` 去推进任务执行，并且提供一个 WebUI，方便查看任务和产出。

## 界面预览

### WebUI

<table>
  <tr>
    <td align="center" width="50%">
      <img src="https://raw.githubusercontent.com/KwokKwok/agent-task/main/docs/assets/agent-task-webui-homepage.png" alt="WebUI 主页卡片页" width="100%" />
      <div>主页卡片页</div>
    </td>
    <td align="center" width="50%">
      <img src="https://raw.githubusercontent.com/KwokKwok/agent-task/main/docs/assets/agent-task-webui-detail.png" alt="WebUI 详情页" width="100%" />
      <div>详情页</div>
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <img src="https://raw.githubusercontent.com/KwokKwok/agent-task/main/docs/assets/agent-task-webui-types.png" alt="任务类型设置弹框" width="100%" />
      <div>任务类型设置</div>
    </td>
    <td align="center" width="50%">
      <img src="https://raw.githubusercontent.com/KwokKwok/agent-task/main/docs/assets/agent-task-webui-sync.png" alt="同步至 OpenClaw 弹框" width="100%" />
      <div>同步至 OpenClaw</div>
    </td>
  </tr>
</table>

### 对话中的任务卡片

<table>
  <tr>
    <td align="center" width="50%">
      <img src="https://raw.githubusercontent.com/KwokKwok/agent-task/main/docs/assets/agent-task-generate.png" alt="生成任务卡片" width="100%" />
      <div>生成任务卡片</div>
    </td>
    <td align="center" width="50%">
      <img src="https://raw.githubusercontent.com/KwokKwok/agent-task/main/docs/assets/agent-task-result.png" alt="任务完成结果卡片" width="100%" />
      <div>任务完成结果卡片</div>
    </td>
  </tr>
</table>

## 快速使用

### 安装后启动 WebUI

```bash
npm install -g @kwokkwok/agent-task
```

直接启动 WebUI，参数按需使用即可：

```bash
agent-task webui start --host 0.0.0.0 --port 3333 --url https://task.example.com
```

- `--host <host>`：监听地址，默认 `127.0.0.1`
- `--port <port>`：监听端口，默认 `3333`
- `--url <url>`：设置 WebUI 的 `publicUrl`，生成链接时优先用它
- `--reset-token`：重置登录 token

### 数据目录

文件默认会放在 `~/.openclaw/agent-task/`。这样和 OpenClaw 放在一起，做备份也比较顺手。你也可以设置 `AGENT_TASK_HOME` 来自定义数据目录

### 跟 OpenClaw 打个招呼

1. 打开页面。
2. 进入设置页。
3. 点击`同步至 OpenClaw`。

后面就可以回到 OpenClaw 开新对话继续用了。

## 如果你要本地开发

先装依赖：

```bash
pnpm install
```

启动 WebUI 服务：

```bash
agent-task webui start
```

配置环境变量连接到服务，比如写到 `.env.local`：

```bash
VITE_API_ORIGIN=http://127.0.0.1:3333
```

启动 WebUI 开发环境：

```bash
pnpm web:dev
```

## 提示词和任务类型

设置页里可以直接改 onboarding prompt、execution prompt 和任务类型。

- onboarding prompt：主要会写进 `AGENTS.md`，用来告诉 OpenClaw 什么时候该创建任务、创建时要带哪些信息
- execution prompt：是在任务真正执行时给 Agent 的要求，主要约定怎么推进任务、怎么产出交付物、怎么处理反馈（目前要求产出`report.md`、`report.html`、`report.mp3`，以及通过飞书卡片消息通知用户，这都可以修改，产物要求也可以维护在任务类型中）
- 任务类型：也可以在设置里维护，会影响执行时看到的类型参考

改完这些后，再点一次`同步至 OpenClaw`就行。

## 它大概能做什么

- 创建任务，改状态，继续推进
- 给每个任务分一个独立 workspace
- 约定一些默认交付物，比如 `report.md`，按约定的来就可以在 WebUI 里进行查看
- 记录 feedback / 返工过程
- 在 WebUI 里看任务、文件、报告、反馈
- 配置 onboarding prompt、execution prompt、任务类型
- 会自动调度任务

比较适合：

- 会产出文件的事
- 不会一轮对话就结束的事
- 后面还要回来继续改的事

如果只是随口问一句、问完就结束，那就没必要用它。

## 它不是什么

它现在不是那种很重的“全自动 AI 平台”。

当前重点还是把这些东西先做稳：

- 记录
- 交付物
- feedback / 返工
- 回看
- WebUI

所以如果你想要的是很完整的自主执行 runtime、通用调度器、多智能体编排系统，`agent-task` 现在还不是这个方向。

## 常用命令

```bash
# 手动初始化数据目录。通常不用，webui start 首次启动时也会自动准备。
agent-task init

# 创建任务。--type 用来指定任务类型。
agent-task create --title "研究可离线语音转写方案" --description "比较三种方案，输出结论和选型理由" --type article_research

# 按状态过滤，比如 todo / in_progress / done / archived。
agent-task list --status todo

# 把 archived 也一起列出来。
agent-task list --all

# 查看单个任务详情。
agent-task show <id>

# 切换任务状态。
agent-task status <id> in_progress
agent-task status <id> done

# 查看这个任务的 feedback 时间线。
agent-task feedback read <id>

# 看 WebUI 现在是不是在跑。
agent-task webui status

# 获取当前登录链接。
agent-task webui token show

# 获取这个任务的产物链接，比如 report / html / 音频 / files。
agent-task webui links <id>

# 查看当前任务类型。
agent-task type list
```

---

have fun~

[npm-image]: https://badge.fury.io/js/%40kwokkwok%2Fagent-task.svg
[npm-url]: https://npmjs.org/package/@kwokkwok/agent-task
