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
 * A plain HTTP endpoint plus the defaults its requests inherit.
 *
 * Unlike the LLM and Jev layers there is no client here — just the facts a
 * request needs. The node decides the verb, path and body; the connection owns
 * the base URL and how the secret is attached, so rotating a key or moving to a
 * staging host never means editing the workflow.
 */
export interface ApiProviderHandle {
  /** Prefix the node's `url` is resolved against. Empty → the url must be absolute. */
  baseUrl: string;
  apiKey?: string;
  /** Header the key travels in. Defaults to `Authorization`. */
  authHeader?: string;
  /** Prefix before the key — `Bearer `, `token `, or `''` for an `x-api-key` style header. */
  authScheme?: string;
  /** Extra headers every request through this connection should carry. */
  headers?: Record<string, string>;
  /** Human label, surfaced in the execution trace. */
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
  /**
   * HTTP connections. Optional so a resolver written before API connections
   * existed still satisfies this interface — an `http` node then just has to
   * carry an absolute URL instead of pointing at a connection.
   */
  api?(id: string): ApiProviderHandle | undefined;
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
  /**
   * True when this node decides *where to go*, not *what the data is*.
   *
   * The engine still records a control-flow node's output under its own id, so
   * `{{jev-1}}` keeps working. It just never lets that output become the
   * implicit "previous output" — otherwise a downstream `{{last}}`, or an End
   * node left without an `output` template, would receive the routing decision
   * instead of the answer that flowed past it.
   */
  readonly controlFlow?: boolean;
  execute(input: NodeExecutionInput): Promise<NodeExecutionOutput>;
}
