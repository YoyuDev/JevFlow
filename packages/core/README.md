# @jevflow/core

面向 AI Agent 的、由决策驱动的工作流运行时。

```
LLM 负责生成  ·  Jev 负责决策  ·  Runtime 负责执行
```

零运行时依赖。开箱即用、完全离线 —— 引擎会退回 mock LLM 和 mock 决策引擎，所以在你还没有任何 API Key 的时候就能把工作流先跑起来。

## 安装

```bash
npm install @jevflow/core
```

## 快速开始

```ts
import { WorkflowEngine, type Workflow } from '@jevflow/core';

const workflow: Workflow = {
  id: 'hello',
  name: 'Hello JevFlow',
  version: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  nodes: [
    { id: 'start-1', type: 'start', position: { x: 0, y: 0 } },
    {
      id: 'llm-1',
      type: 'llm',
      position: { x: 0, y: 120 },
      config: { prompt: '请介绍一下：{{input}}' },
    },
    {
      id: 'jev-1',
      type: 'jev',
      position: { x: 0, y: 240 },
      config: { question: '回答是否完整？', choices: ['complete', 'incomplete'] },
    },
    { id: 'end-1', type: 'end', position: { x: 200, y: 360 } },
  ],
  edges: [
    { id: 'e1', source: 'start-1', target: 'llm-1' },
    { id: 'e2', source: 'llm-1', target: 'jev-1' },
    { id: 'e3', source: 'jev-1', target: 'end-1', condition: 'complete' },
  ],
};

const engine = new WorkflowEngine();
const result = await engine.run(workflow, { input: 'AI Agent' });

console.log(result.status); // 'completed'
console.log(result.trace); // 每个节点一条记录，包含 Jev 决策
```

## 可以注入什么

所有东西都是接口，没有一处是写死的：

```ts
const engine = new WorkflowEngine({
  llm: myLLMClient, // LLMClient
  jev: myJevClient, // JevClient
  tools: myToolRegistry, // ToolRegistryLike
  executors: [myNodeExecutor], // NodeExecutor —— 接入你自己的节点类型
  logger: myLogger,
  maxSteps: 50,
  hooks: {
    onNodeFinish: ({ record }) => console.log(record.label, record.status),
  },
});
```

引擎上那对 `llm` / `jev` 是整个工作流的**默认**。想让不同节点走不同服务时，用 `providers` 注册几张「具名连接」，节点在配置里写上 `providerId` 就行：

```ts
import { ProviderRegistry, WorkflowEngine } from '@jevflow/core';

const engine = new WorkflowEngine({
  providers: ProviderRegistry.from([
    { id: 'fast', kind: 'llm', apiKey: '…', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
    { id: 'smart', kind: 'llm', apiKey: '…', baseUrl: 'https://api.siliconflow.cn/v1', model: 'Qwen/Qwen2.5-72B-Instruct' },
    { id: 'policy', kind: 'jev', apiKey: '…', baseUrl: 'https://my-jev.internal' },
  ]),
});

await engine.run(
  {
    /* … */
    nodes: [
      { id: 'draft', type: 'llm', position: { x: 0, y: 0 }, config: { providerId: 'fast', prompt: '{{input}}' } },
      { id: 'polish', type: 'llm', position: { x: 0, y: 120 }, config: { providerId: 'smart', prompt: '{{last}}' } },
      { id: 'judge', type: 'jev', position: { x: 0, y: 240 }, config: { providerId: 'policy', question: '够好了吗？', choices: ['yes', 'no'] } },
    ],
    /* … */
  },
  { input: '…' },
);
```

几条约定：

- 没写 `providerId` 的节点用引擎上的默认 client；`providerId` 指向一个不存在的连接也一样。
- 连接里没有 `apiKey` 会退化成对应的 Mock，**不会**让整个 run 失败。
- `providers` 是可选的 —— 不传时引擎的行为和以前完全一致。
- 节点里的 `model` 留空就用连接自己的模型；填了就以节点为准（`mock-model` 视为「没填」）。
- 用到的连接名会写进节点输出的 `provider` 字段，执行记录里能看出这一步到底走了谁。
- Jev 是**控制流**节点：它的输出**不进**「上一个输出」——`{{last}}` 和没配 `output` 的 End 节点都会跳过它。要引用判断结果请显式写 `{{jev-1}}` / `{{jev-1.choice}}`。（自定义控制流节点只要在 executor 上标 `controlFlow: true` 即可获得同样待遇。）

## 导出清单

`WorkflowEngine` · `DecisionRouter` · `ExecutionContext` · `ExecutionTrace` ·
`NodeExecutorRegistry` · `MockLLMClient` · `RealLLMClient` · `MockJevClient` ·
`RealJevClient` · `ProviderRegistry` · `ToolRegistry` · `MockSearchTool` · `WorkflowError` ·
`Workflow` · `WorkflowNode` · `WorkflowEdge` · `DecisionResult` · `NodeProviderResolver`，
以及其余全部类型。

## 环境要求

Node.js `>= 20`。本包本身没有原生依赖，换 Node 版本不需要重建。

## 许可证

MIT
