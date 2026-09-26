# Research Agent（无界面示例）

直接用 Node.js 跑 **Research Agent** 工作流，只依赖 `@jevflow/core` —— 不需要服务端、不需要 SQLite、不需要浏览器、不需要 API Key。

```bash
# 在仓库根目录
pnpm install
pnpm example:research

# 也可以换成你自己的问题
pnpm example:research "帮我研究一下工作流引擎的停止条件设计"
```

## 这个示例演示了什么

- **决策驱动的路由** —— `jev-1` 判定 `incomplete`，于是流程拐进检索分支，而不是直接走到 `End`。
- **模板变量串联** —— `{{input}}`、`{{tool-1}}`、`{{llm-1}}` 都从本次运行的上下文里取值，所以 `llm-2` 能同时看到检索命中和第一版草稿。
- **执行记录** —— 每个节点一行，Jev 节点的决策会带上它的 `probability` / `confidence`。
- **重试闭环** —— 如果 `jev-2` 也判成 `incomplete`，`edge-8` 会把流程送回检索节点再跑一轮。

## 完整的运行时调用

```ts
import { WorkflowEngine } from '@jevflow/core';

const engine = new WorkflowEngine(); // MockLLMClient + MockJevClient
const result = await engine.run(workflow, { input: '请介绍一下 AI Agent' });

console.log(result.status); // 'completed'
console.log(result.trace); // NodeExecutionRecord[]
```
