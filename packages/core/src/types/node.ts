import type { DecisionResult } from './decision.js';
import type { WorkflowNode, WorkflowNodeType } from './workflow.js';

/* -------------------------------------------------------------------------- */
/* Named providers — “this node talks to that connection”                     */
/* -------------------------------------------------------------------------- */

/** An LLM client plus the defaults it was configured with. */
export interface LLMProviderHandle {
  client: import('./llm.js').LLMClient;
  /** Model a node inherits when it does not pin one of its own. */
  model?: string;
  /** Human label, surfaced in the execution trace. */
  label: string;
}

/** A decision client plus its label. */
export interface JevProviderHandle {
  client: import('./decision.js').JevClient;
  label: string;
}

/**
 * Looks a provider up by the id a node carries in `config.providerId`.
 *
 * Optional everywhere: an engine with no registry behaves exactly as it did
 * before — one default client for the whole workflow.
 */
export interface NodeProviderResolver {
  llm(id: string): LLMProviderHandle | undefined;
  jev(id: string): JevProviderHandle | undefined;
}

/** Everything a node executor may depend on. */
export interface NodeExecutorDeps {
  /** Fallback generation layer, used by nodes without their own `providerId`. */
  llm: import('./llm.js').LLMClient;
  /** Fallback decision layer, used by nodes without their own `providerId`. */
  jev: import('./decision.js').JevClient;
  tools: import('./tool.js').ToolRegistryLike;
  logger: import('./logger.js').Logger;
  /** Named providers a node may point at. Absent → every node uses the defaults. */
  providers?: NodeProviderResolver;
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
