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
- **六种节点** —— `Start` · `LLM` · `Jev` · `Tool` · `HTTP` · `End`。
- **Jev 决策节点** —— 一个问题加一组固定选项，返回 `choice` / `probability` / `confidence`。
- **决策路由** —— 引擎按决策结果挑出对应的出边；没匹配上就明确报错，绝不悄悄猜一条。
- **完整执行记录** —— 每个节点的状态、输入、输出、耗时和决策，全部落进 SQLite。
- **完全离线可跑** —— 内置 mock LLM、mock Jev、mock search，`.env` 空着也能跑 Demo。
- **按节点选连接** —— 设置里存多套 LLM / Jev / API 连接，每个节点各挑一套；密钥只留在浏览器，运行时按次下发。
- **工作流即 API** —— 把工作流发布成一个 HTTP 端点，别的服务拿着 token 就能调用并拿到结果；调用方不需要知道任何 API Key。
- **反向也通** —— `HTTP` 节点让工作流自己去调别人的接口：选一条连接，配 method / 路径 / 请求体，响应直接交给下游节点。
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
│    NodeExecutors：Start · LLM · Jev · Tool · HTTP · End                 │
│         │                                                              │
│    LLMClient   ·  JevClient   ·  ToolRegistry   ·  fetch（内置）        │
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
- **项目管理**：顶栏「项目」按钮打开管理面板 —— 新建、打开、重命名、复制、删除都在这里，卡片上能看到节点数、连线数、版本与最后更新时间。顶栏的「新建项目」从空白画布开始（只带一个 Start 节点），保存前它会以「未命名项目 · 未保存」出现在下拉里。删除与切换都有确认，画布上有未保存改动时切换会先问一句（空白的新项目不算改动）；删除当前项目后会自动切到列表里的下一个。

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

### 模板变量

`prompt`、`systemPrompt`、`query`、`url`、`headers`、`body`、`output` 里都能写模板变量。

| 变量 | 含义 |
| --- | --- |
| `{{input}}` | 本次运行的输入 —— `{ input: "..." }` 里的那个 `input` 本身 |
| `{{rawInput}}` | 整个入口对象，原样 |
| `{{last}}` | 上一个节点的输出 |
| `{{<节点 id>}}` | 任意一个**更早**节点的输出，例如 `{{llm-1}}` |
| `{{lastLLM}}` | 最近一次 LLM 回答的纯文本 |
| `{{lastTool}}` | 最近一次工具调用的结果 |
| `{{lastHttp}}` | 最近一次 HTTP 调用的响应（能当 JSON 就已是对象） |

变量名就是**节点 id** —— 画布上每个节点跑过之后都会以自己的 id 登记一份输出，所以 `{{tool-1}}` 取的就是 `tool-1` 的输出。

几条取值规则：

- **对象不会原样倒进 prompt。** 渲染一个对象时依次看：有 `content` 就取 `content`（LLM 节点）；有 `results` 就把数组逐条换行拼起来（Tool 节点）；有 `text` 就取 `text`；都没有才输出美化过的 JSON。所以 `{{tool-1}}` 给你的是那几条资料，而不是带 `provider` / `tookMs` 的整包；`{{llm-1}}` 给你正文，而不是 `{ content, model, usage }`。
- **可以用点号取子字段。** `{{jev-1.choice}}`、`{{jev-1.probability}}`、`{{llm-1.model}}`、`{{tool-1.total}}`、`{{tool-1.results}}` 都能用。Jev 节点的判断结果只能这样拿 —— 判断对象整体没有 `content` / `results` / `text`，直接渲染会得到一整段 JSON。
- **只能引用画布上位于它左边的节点。** 引用一个还没跑过的节点得到的是**空串** —— 不报错，也没有兜底语法。所以写 `{{llm-2}}` 之前要确认那条路径真的会经过 `llm-2`（例如它在判断节点的一条分支上，而那条分支不一定会走）。
- **同一个节点重复执行时，它的变量是最新那次的值。** 循环里旧值不保留。
- **未知变量一律渲染成空串**，不会让这次运行失败。因此拼错 id 只会静默丢内容，不会报错 —— 值得在用完模板后回看一眼执行记录里的实际输出。
- Studio 的节点配置面板下方有「可用变量」列表，点一下就追加到该节点的主输入框，不用手打。

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

1. 在「连接配置」里存下若干套连接（名称 / API Key / Base URL / 模型），LLM、Jev、API 分成三个页签；
2. 每张卡片都能单独「测试连接」，也能看到它**被几个节点在用**；
3. 选中一个 LLM / Jev / HTTP 节点，在右侧「节点配置 → 连接」里挑这一套。

不选就是「跟随服务端默认」，也就是 `.env`，没有 `.env` 就是 Mock。所以老工作流不用改任何东西。

几条设计上的取舍：

- **密钥只存在浏览器里**（`localStorage`），不进 SQLite。数据库是一个会被随手拷走的文件，API Key 不该躺在里面。
- 运行时只有**被节点引用到的**那几套连接会随请求发出去，服务端也是用完即弃，只把 `input` 写进库。
- 节点配置里存的只是**连接 id**，所以导出的工作流 JSON 可以放心分享。
- 连接被删掉、或忘了填 Key，节点会安全回落到默认 / Mock，并在配置面板给出黄色提示，而不是运行到一半报错。

### HTTP 节点（工作流去调别人的接口）

前面那节是「别人调用工作流」；`HTTP` 节点是反方向 —— **工作流自己去调别人的接口**，把响应交给下游。

配置分两半，各管各的：

| 谁 | 管什么 |
| --- | --- |
| **API 连接**（设置里） | Base URL、鉴权怎么加（头名 + 前缀）、所有请求都带的固定头 |
| **HTTP 节点**（画布上） | method、路径、额外头、请求体、超时、非 2xx 怎么办 |

这么分的好处很实在：把整套流程从测试环境切到生产，或者轮换一个密钥，都是**设置里的改动，不用动画布**。

```ts
{
  type: 'http',
  config: {
    providerId: 'api-audit',           // 指向设置里的一条 API 连接
    method: 'POST',
    url: '/v1/tickets?q={{input}}',    // 相对路径，拼在 Base URL 后面
    headers: 'x-org: acme',            // 一行一个「名称: value」
    body: '{"question": "{{input}}"}',
    timeoutMs: 15000,
    failOnError: true,
  },
}
```

`url` 写成完整的 `https://…` 时**不选连接也能跑** —— 这一条是为了让 `@jevflow/core` 在没有 registry 的嵌入场景里照样能用。

几个行为上的约定：

- 鉴权默认是 `Authorization: Bearer <key>`；连接里把前缀留空，就变成 `x-api-key: <key>` 那种写法。
- 请求体只对 `GET` 之外的方法发送；带了请求体又没自己写 `content-type`，会自动补 `application/json`。
- 节点里写的同名头**覆盖**连接里的 —— 连接给默认，节点给特例。
- 响应能解析成 JSON 就当对象，否则原样给字符串，都是下游节点看到的输出。
- **非 2xx 默认让节点失败**，错误信息里带状态码和响应片段。关掉 `failOnError` 之后，非 2xx 会作为 `{ ok: false, status, body }` 交给下游 —— 这样「尽力调一下，失败也别停」用 Jev 节点就能表达。

### 对外 API（把工作流接进你自己的代码）

Studio 里跑工作流，靠的是浏览器 `localStorage` 里的 Key。想让**别的服务**调用同一个工作流，就把它发布出去：顶栏「对外 API」→「发布为 API」。

发布之后你拿到两样东西 —— 一个地址，一个 token：

```bash
curl -X POST "http://127.0.0.1:3000/api/v1/run" \
  -H "x-api-key: jf_xxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"input":"请介绍一下 AI Agent"}'
```

```json
{
  "executionId": "exec-muk1wljc-36uhes",
  "workflowId": "research-agent",
  "status": "completed",
  "output": { "choice": "complete", "confidence": 0.95 },
  "steps": 7,
  "durationMs": 412
}
```

面板里直接给 cURL / JavaScript / Java 三种示例，复制即用。

**凭据从哪来？** 这是「发布」和「本地跑」最大的区别：调用方手里只有一个 token，服务端必须自己知道该用哪套模型。所以点发布时，Studio 会把**当前工作流引用到的连接**一起传上去，服务端用 AES-256-GCM 加密后存进 SQLite（密钥来自 `JEVFLOW_SECRET`，没配就自动生成 `data/.secret`）。节点指向哪套连接，外部调用就用哪套，跟你在 Studio 里跑完全一致。

快照是空的（工作流没引用任何连接）就回落到服务端 `.env`；`.env` 也空着，那就是 Mock。

| 端点 | 说明 |
| --- | --- |
| `POST /api/v1/run` | 同步跑完并返回结果；加 `?mode=async` 则立刻返回 `202` + `executionId` |
| `GET /api/v1/executions/:id` | 查异步执行的结果；一个 token 只能读自己工作流的记录 |
| `GET /api/v1/health` | 免鉴权探活 |

鉴权用 `x-api-key`，或 `Authorization: Bearer <token>`。无 token 是 `401`，token 不对也是 `401`，端点被暂停是 `403` —— 调用方不用翻日志就能分清是哪种。

面板上还能随时**暂停 / 恢复**（token 不变）、**换 token**（旧的立刻失效）、**更新凭据**（工作流改了连接引用之后重新快照）、**撤销**（端点删除、token 作废）。调用次数、失败次数、最近调用时间都记在端点上。

几条边界：

- 工作流被删除时端点会跟着删掉（外键级联），不会留下指向空气的 token。
- 对外响应里**不带执行轨迹**，只给结果 —— 轨迹是给你自己看的。
- token 明文存在本地 SQLite 里，方便随时回看。**别把服务端直接暴露到公网**；真要对外，放在反向代理后面并自己再加一层鉴权。
- 想让局域网里的别人访问，把 `.env` 的 `HOST` 从 `127.0.0.1` 改成 `0.0.0.0`。

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
# 本地管理接口（Studio 使用，假定访问者就是本机主人）
GET    /api/workflows
GET    /api/workflows/:id
POST   /api/workflows
PUT    /api/workflows/:id
DELETE /api/workflows/:id
POST   /api/workflows/:id/run
GET    /api/workflows/:id/executions
GET    /api/workflows/:id/endpoint
POST   /api/workflows/:id/endpoint
DELETE /api/workflows/:id/endpoint
GET    /api/executions/:id
GET    /api/executions/:id/nodes
GET    /api/runtime
GET    /api/health
GET    /api/node-types

# 对外接口（用端点 token 鉴权，见上文「对外 API」）
POST   /api/v1/run
GET    /api/v1/executions/:id
GET    /api/v1/health
```

## 数据库

SQLite，驱动是 `better-sqlite3`，文件自动创建在 `data/jevflow.db`。

```text
workflows         id, name, description, version, definition_json, created_at, updated_at
executions        id, workflow_id, status, input, output, error, steps, started_at, finished_at, duration_ms
execution_nodes   id, execution_id, node_id, node_type, label, status, input, output,
                  decision, probability, confidence, error, started_at, finished_at, duration_ms
workflow_endpoints workflow_id, token, enabled, providers_json, published_at,
                  call_count, error_count, last_called_at, created_at, updated_at
```

工作流整体存成一份 JSON（`definition_json`），而不是拆成 nodes / edges 两张表 —— 第一阶段完全不需要在定义内部做查询。

`workflow_endpoints.providers_json` 是全项目**唯一**一处凭据落库的地方，而且存的是密文（AES-256-GCM，密钥来自 `JEVFLOW_SECRET`，没配就用自动生成的 `data/.secret`）。对外 API 必须能在没有调用方参与的情况下自己跑起来，这个例外躲不掉 —— 那就至少让它别以明文躺着。换过 `JEVFLOW_SECRET` 之后旧密文解不开，端点会安全回落到 `.env` / Mock，面板上也会明确提示「凭据无法解密，请重新发布」。

## 后续规划

- **更多节点类型** —— Agent、RAG、Code、人工审核、Condition、MCP。
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
