import type { DecisionResult } from './decision.js';
import type { WorkflowNode, WorkflowNodeType } from './workflow.js';

/** Everything a node executor may depend on. */
export interface NodeExecutorDeps {
  llm: import('./llm.js').LLMClient;
  jev: import('./decision.js').JevClient;
  tools: import('./tool.js').ToolRegistryLike;
  logger: import('./logger.js').Logger;
}

/** What the engine hands to an executor. */
export interface NodeExecutionInput {
  node: WorkflowNode;
  context: import('./execution.js').ExecutionContextLike;
  deps: NodeExecutorDeps;
}

/** What an executor hands back. */
export interface NodeExecutionOutput {
  output: unknown;
  /** Only Jev nodes produce this; the engine uses it to pick the outgoing edge. */
  decision?: DecisionResult;
  /** Extra trace metadata (model name, tool provider, ...). */
  meta?: Record<string, unknown>;
}

/**
 * The unified node interface. Adding a node type means adding one executor —
 * the engine never changes.
 */
export interface NodeExecutor {
  readonly type: WorkflowNodeType;
  execute(input: NodeExecutionInput): Promise<NodeExecutionOutput>;
}
