# JevFlow

**面向 AI Agent 的、由决策驱动的可视化工作流运行时。**

```text
LLM 负责生成
Jev 负责决策
Runtime 负责执行
```

JevFlow 不是一个 AI 聊天站，也不是流程图工具。它是一套很小的运行时：**LLM 产出内容 → 决策引擎 Jev 判断这些内容够不够用 → 运行时按判断结果走真正的工作流分支 → 再把整个过程记下来**，让你能看清它*为什么*这么走。

```text
可视化工作流 → LLM 节点 → Jev 决策节点 → 决策路由
      → 分支 A（End）/ 分支 B（Tool → LLM → 再问一次 Jev）
      → 继续 / 重试 / 继续检索 / 转人工 / 结束
```

---

## 功能特性

- **可视化编辑器** —— 把节点拖到 Vue Flow 画布上连线，在右侧面板配置。
- **五种节点** —— `Start` · `LLM` · `Jev` · `Tool` · `End`。
- **Jev 决策节点** —— 一个问题加一组固定选项，返回 `choice` / `probability` / `confidence`。
- **决策路由** —— 引擎按决策结果挑出对应的出边；没匹配上就明确报错，绝不悄悄猜一条。
- **完整执行记录** —— 每个节点的状态、输入、输出、耗时和决策，全部落进 SQLite。
- **完全离线可跑** —— 内置 mock LLM、mock Jev、mock search，`.env` 空着也能跑 Demo。
- **按节点选连接** —— 设置里存多套 LLM / Jev 连接，每个节点各挑一套；密钥只留在浏览器，运行时按次下发。
- **可独立发布的 core** —— `@jevflow/core` 零运行时依赖，可以直接嵌进任何 Node.js 项目。
- **中文优先，可切英文** —— 界面默认简体中文，右上角一键切换；文案走 i18n，不写死在组件里。
- **浅色 / 深色主题** —— 首次访问跟随系统，用户选过之后记住选择，刷新不闪白。
- **失败有据可查** —— 节点缺失、边缺失、LLM / Jev / Tool 调用失败、循环超限都有明确错误码。

## 架构

```text
┌──────────────────────── JevFlow Studio (Vue 3) ────────────────────────┐
│  节点库            画布（Vue Flow）              配置面板               │
│                          │                                             │
│                    执行记录（底部面板）                                 │
└──────────────────────────┼─────────────────────────────────────────────┘
                           │  REST /api
┌──────────────────────────▼─────────────────────────────────────────────┐
│  Server（Fastify）                                                     │
│    routes → services → repositories（SQLite）                          │
└──────────────────────────┬─────────────────────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────────────────────┐
│  @jevflow/core                                                         │
│    WorkflowEngine ─ DecisionRouter ─ ExecutionContext ─ ExecutionTrace │
│         │                                                              │
│    NodeExecutors：Start · LLM · Jev · Tool · End                        │
│         │                                                              │
│    LLMClient   ·  JevClient   ·  ToolRegistry                          │
│    ├ MockLLMClient   ├ MockJevClient   └ MockSearchTool   （离线）      │
│    └ RealLLMClient   └ RealJevClient   └ 你自己的工具      （配了 key） │
└────────────────────────────────────────────────────────────────────────┘
```

依赖箭头只有一个方向：引擎完全不知道 Fastify、SQLite 和 Vue 的存在。正因如此，`packages/core` 才能单独发布。

## 目录结构

```text
jevflow/
├── apps/
│   ├── studio/            # Vue 3 + Vue Flow 可视化编辑器
│   └── server/            # Fastify API + SQLite
├── packages/
│   └── core/              # @jevflow/core —— 运行时本体
├── examples/
│   └── research-agent/    # 直接调用 @jevflow/core 的无界面示例
├── data/                  # SQLite 文件放这里（已 gitignore）
└── pnpm-workspace.yaml
```

## 快速开始

```bash
git clone <repository>
cd jevflow
pnpm install
pnpm dev
```

- Studio → http://localhost:5173
- API → http://localhost:3000

`pnpm dev` 会先构建一次 `@jevflow/core`，然后把 server 和 Studio 并行起起来。不需要 API Key、不需要 `.env`、不需要建库：SQLite 首次启动自动创建在 `data/jevflow.db`，并把 **Research Agent** 示例工作流灌进去。

### 环境要求

| 项 | 要求 |
| --- | --- |
| Node.js | `>= 20`（本项目在 Node 22 / 24 上验证过） |
| 包管理器 | pnpm（`pnpm@11`） |

> **换过 Node 大版本后报 `NODE_MODULE_VERSION` 不匹配？**
> SQLite 用的是原生模块 `better-sqlite3`，它在安装时按**当前 Node 的 ABI** 下载二进制。所以用 Node A 装、用 Node B 跑就会加载失败。解决办法是用你实际要跑服务的那个 Node 重新构建一次：
>
> ```bash
> pnpm rebuild better-sqlite3
> ```
>
> 服务端启动时如果撞到这个错，也会直接把上面这行命令打出来，不用去猜。

### 手动安装与常用命令

```bash
pnpm install            # 安装所有 workspace
pnpm build              # 构建 core、server 与 studio
pnpm typecheck          # 全仓类型检查（tsc / vue-tsc）
pnpm seed               # 把示例工作流（重新）写进 SQLite
pnpm start              # 跑构建产物形态的服务端
pnpm example:research   # 无界面跑一遍 Research Agent
```

## 界面

- **语言**：默认简体中文。顶栏右上角可在「中文 / English」之间切换，选择记在 `localStorage`，同时会同步 `<html lang>`。Element Plus 的内置文案（弹窗、下拉空状态等）也跟着切。
- **主题**：顶栏右上角的太阳/月亮按钮切换浅色与深色。第一次访问跟随系统的 `prefers-color-scheme`，一旦你手动切过就以你的选择为准，刷新时由一段首帧前的内联脚本先套上，不会闪白。
- **字体**：默认中文优先字体栈（PingFang SC → HarmonyOS Sans SC → 微软雅黑 → 思源黑体 → Noto Sans SC），代码块走等宽栈并带中文回退。
- **布局**：左侧节点库、右侧节点面板、底部执行轨迹都可以拉伸 —— 鼠标移到分隔线上拖，或聚焦分隔线后用方向键（`Shift` 加速、`Home` / `End` 到两端、双击或回车恢复默认）。尺寸记在 `localStorage`，画布始终保留最小可用宽高，窗口缩小时越界的尺寸会自动收回。
- **连接配置**：右上角齿轮管理 LLM / Jev 连接（可多套、可测试、可看被哪些节点引用）。具体见上文「按节点选连接」。

> 工作流里的节点名称、Jev 问题、Prompt 这些属于**你的数据**，不会被界面语言影响；语言切换只改界面本身。

## Demo

打开 Studio，用默认输入 `请介绍一下 AI Agent` 点「运行工作流」，Research Agent 会这样跑：

```text
✓ Start        入口
✓ LLM          起草回答
✓ Jev          choice=incomplete  p=0.84  c=0.91
✓ Tool         mock search
✓ LLM          用检索结果重写回答
✓ Jev          choice=complete    p=0.93  c=0.95
✓ End
```

第一个 `Jev` 判定「信息不够」，于是流程被路由进检索分支；第二轮起草后判断翻成「够了」，走到 `End`。整个过程不花钱、不联网，但把运行时的每条链路都跑了一遍。

## 工作流示例

```ts
const workflow: Workflow = {
  id: 'research-agent',
  name: 'Research Agent',
  version: 1,
  nodes: [
    { id: 'start-1', type: 'start', position: { x: 340, y: 0 } },
    {
      id: 'llm-1',
      type: 'llm',
      position: { x: 340, y: 150 },
      config: { model: 'mock-model', prompt: '请介绍一下：{{input}}', temperature: 0.7 },
    },
    {
      id: 'jev-1',
      type: 'jev',
      position: { x: 340, y: 320 },
      config: {
        question: '当前信息是否足以完整回答用户的问题？',
        choices: ['complete', 'incomplete', 'invalid'],
      },
    },
    // ...
  ],
  edges: [
    { id: 'edge-3', source: 'jev-1', target: 'end-1', condition: 'complete' },
    { id: 'edge-4', source: 'jev-1', target: 'tool-1', condition: 'incomplete' },
  ],
};
```

`prompt`、`query`、`output` 里可用的模板变量：

| 变量 | 含义 |
| --- | --- |
| `{{input}}` | 本次运行的输入（`{ input: "..." }`） |
| `{{last}}` | 上一个节点的输出 |
| `{{<节点 id>}}` | 任意一个更早节点的输出，例如 `{{llm-1}}` |
| `{{lastLLM}}` | 最近一次 LLM 回答的纯文本 |
| `{{lastTool}}` | 最近一次工具调用的结果 |

## Jev 决策

Jev 节点针对当前状态提一个问题，然后只能从**一组固定选项里挑一个**回答 —— 不接受自由文本，所以路由永远不会含糊。

```ts
{
  type: 'jev',
  config: {
    question: '当前信息是否足够？',
    choices: ['complete', 'incomplete', 'invalid'],
  },
}
```

```ts
interface DecisionResult {
  choice: string;
  probability?: number;
  confidence?: number;
  reason?: string;
}
```

`DecisionRouter` 只干一件事：先按 `condition` 精确匹配出边，再退到兜底分支（`default` / `else` / `*` / 没写条件的边），都没有就抛 `EDGE_NOT_FOUND`，并在执行记录里把失败节点标出来。

### Mock 与真实实现

| 层 | 离线默认 | 配了凭据之后 |
| --- | --- | --- |
| LLM | `MockLLMClient` | `RealLLMClient` —— 任何 OpenAI 兼容端点 |
| Jev | `MockJevClient` | `RealJevClient` —— 你自己的决策接口 |
| Tools | `MockSearchTool` | 你自己实现的 `Tool` |

把 `.env.example` 复制成 `.env`，有什么填什么。**留空即继续用 mock** —— 缺 Key 绝不会把项目变成跑不起来的状态。

```env
PORT=3000
JEV_BASE_URL=
JEV_API_KEY=
LLM_BASE_URL=
LLM_API_KEY=
LLM_MODEL=
```

### 按节点选连接（Studio 设置）

`.env` 只有一个「默认」位置。但同一个工作流里，常常希望**不同的节点走不同的服务**——比如一个节点用便宜的快模型跑初稿，另一个节点用强模型做终稿。

Studio 右上角的齿轮就是干这个的：

1. 在「连接配置」里存下若干套连接（名称 / API Key / Base URL / 模型），LLM 与 Jev 分开两个页签；
2. 每张卡片都能单独「测试连接」，也能看到它**被几个节点在用**；
3. 选中一个 LLM / Jev 节点，在右侧「节点配置 → 连接」里挑这一套。

不选就是「跟随服务端默认」，也就是 `.env`，没有 `.env` 就是 Mock。所以老工作流不用改任何东西。

几条设计上的取舍：

- **密钥只存在浏览器里**（`localStorage`），不进 SQLite。数据库是一个会被随手拷走的文件，API Key 不该躺在里面。
- 运行时只有**被节点引用到的**那几套连接会随请求发出去，服务端也是用完即弃，只把 `input` 写进库。
- 节点配置里存的只是**连接 id**，所以导出的工作流 JSON 可以放心分享。
- 连接被删掉、或忘了填 Key，节点会安全回落到默认 / Mock，并在配置面板给出黄色提示，而不是运行到一半报错。

## 执行记录（Execution Trace）

底部面板（以及 `executions` / `execution_nodes` 两张表）按节点记录：

```text
状态 · 输入 · 输出 · 耗时 · 决策 · 概率 · 置信度
```

失败时会多一行 `✕` 并列出具错误原因，例如：

```text
✕ Jev 节点
  错误：Jev request failed
```

> 数据库里存的是原始英文状态值（`success` / `failed` / `completed` 等），中文只是界面显示，这样接口和存储不会因为语言切换而变。

## 作为 npm 包使用

```bash
npm install @jevflow/core
```

```ts
import { WorkflowEngine } from '@jevflow/core';

const engine = new WorkflowEngine(); // 默认 mock LLM + mock Jev

const result = await engine.run(workflow, { input: 'Hello JevFlow' });

console.log(result.status); // 'completed'
console.log(result.trace);  // NodeExecutionRecord[]
```

完整的无界面示例见 [`examples/research-agent`](examples/research-agent)，跑 `pnpm example:research`。

## API

```text
GET    /api/workflows
GET    /api/workflows/:id
POST   /api/workflows
PUT    /api/workflows/:id
DELETE /api/workflows/:id
POST   /api/workflows/:id/run
GET    /api/workflows/:id/executions
GET    /api/executions/:id
GET    /api/executions/:id/nodes
GET    /api/runtime
GET    /api/health
GET    /api/node-types
```

## 数据库

SQLite，驱动是 `better-sqlite3`，文件自动创建在 `data/jevflow.db`。

```text
workflows        id, name, description, version, definition_json, created_at, updated_at
executions       id, workflow_id, status, input, output, error, steps, started_at, finished_at, duration_ms
execution_nodes  id, execution_id, node_id, node_type, label, status, input, output,
                 decision, probability, confidence, error, started_at, finished_at, duration_ms
```

工作流整体存成一份 JSON（`definition_json`），而不是拆成 nodes / edges 两张表 —— 第一阶段完全不需要在定义内部做查询。

## 后续规划

- **更多节点类型** —— Agent、RAG、HTTP、Code、人工审核、Condition、MCP。
- **流式运行** —— 用 SSE 实时推执行记录，画布边跑边亮。
- **`create-jevflow`** —— `npx create-jevflow my-agent` 脚手架。
- **真实 Jev 接入** —— 把托管决策 API 做成一级配置项。
- **工作流版本历史 / 差异对比** —— 不止一个 `version` 数字。

明确**暂不做**：账号体系、团队协作、云端托管、容器化、Kubernetes、Redis、Postgres、Kafka、微服务、多租户、计费、插件市场。

## 技术栈

Vue 3 · TypeScript · Vite · Vue Flow · Element Plus · Pinia · vue-i18n · Axios ·
Node.js · Fastify · SQLite（`better-sqlite3`） · pnpm workspaces · ESLint · Prettier

## 许可证

[MIT](LICENSE)
