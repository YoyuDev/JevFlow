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

## 导出清单

`WorkflowEngine` · `DecisionRouter` · `ExecutionContext` · `ExecutionTrace` ·
`NodeExecutorRegistry` · `MockLLMClient` · `RealLLMClient` · `MockJevClient` ·
`RealJevClient` · `ToolRegistry` · `MockSearchTool` · `WorkflowError` ·
`Workflow` · `WorkflowNode` · `WorkflowEdge` · `DecisionResult`，以及其余全部类型。

## 环境要求

Node.js `>= 20`。本包本身没有原生依赖，换 Node 版本不需要重建。

## 许可证

MIT
