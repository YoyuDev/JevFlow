/**
 * Core workflow data structures.
 *
 * These types are the wire format too: whatever the Studio saves into
 * `definition_json`, the runtime consumes unchanged.
 */

/** Node types shipped so far. Everything else is a later phase. */
export type WorkflowNodeType = 'start' | 'llm' | 'jev' | 'tool' | 'http' | 'end';

export interface NodePosition {
  x: number;
  y: number;
}

/* -------------------------------------------------------------------------- */
/* Node configs                                                               */
/* -------------------------------------------------------------------------- */
/* NOTE: these are `type` aliases, not `interface`, on purpose — only type      */
/* aliases get an implicit index signature, which is what lets us assign them   */
/* to `Record<string, unknown>` when a workflow is serialised.                  */

export type StartNodeConfig = Record<string, unknown>;

export type LLMNodeConfig = {
  /** Model identifier passed to the LLM client. Falls back to the client default. */
  model?: string;
  /** Role / behaviour instructions. `{{input}}` style templates are supported. */
  systemPrompt?: string;
  /** The user prompt. Supports `{{input}}`, `{{last}}`, `{{<node-id>}}` templates. */
  prompt?: string;
  temperature?: number;
  maxTokens?: number;
};

export type JevNodeConfig = {
  /**
   * Id of a named decision provider this node should use.
   * Omitted → the engine's default Jev client.
   */
  providerId?: string;
  /** The question Jev has to answer about the current workflow state. */
  question?: string;
  /** Allowed answers. The engine routes on whichever one Jev returns. */
  choices?: string[];
  /** Optional extra template appended to the decision context. */
  contextTemplate?: string;
};

export type ToolNodeConfig = {
  /** Name of a registered tool, e.g. `search`. */
  tool?: string;
  /** Query template, e.g. `{{input}}`. */
  query?: string;
  /** Extra static args merged into the tool call. */
  args?: Record<string, unknown>;
};

export type EndNodeConfig = {
  /** Optional output template. Defaults to "whatever the previous node produced". */
  output?: string;
};

/** Verbs the editor offers; any string is accepted at runtime. */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type HttpNodeConfig = {
  /**
   * Id of a saved API connection this node should use.
   * Omitted → `url` has to be absolute, since there is nothing to prefix it with.
   */
  providerId?: string;
  /** Request verb. Defaults to `GET`. */
  method?: HttpMethod;
  /**
   * Path appended to the connection's base URL, or a full `https://…` URL when
   * no connection is selected. Supports `{{input}}` / `{{node-id}}` templates.
   */
  url?: string;
  /** Extra headers, one `Name: value` per line. Values support templates. */
  headers?: string;
  /** Request body, sent for every verb except GET. Supports templates. */
  body?: string;
  /** Abort the request after this many ms. Defaults to 15000. */
  timeoutMs?: number;
  /**
   * `true` (default) → a non-2xx response fails the node.
   * `false` → the response is passed downstream as `{ ok: false, status, body }`,
   * which is how you let a Jev node branch on “the API said no”.
   */
  failOnError?: boolean;
};

/** Maps a node type to its config shape. Handy for building workflows in code. */
export interface NodeConfigMap {
  start: StartNodeConfig;
  llm: LLMNodeConfig;
  jev: JevNodeConfig;
  tool: ToolNodeConfig;
  http: HttpNodeConfig;
  end: EndNodeConfig;
}

export type NodeConfigOf<T extends WorkflowNodeType> = NodeConfigMap[T];

/* -------------------------------------------------------------------------- */
/* Nodes & edges                                                              */
/* -------------------------------------------------------------------------- */

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  position: NodePosition;
  /** Display name. Defaults to a per-type label when omitted. */
  label?: string;
  config?: Record<string, unknown>;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  /**
   * Outgoing condition.
   * - After a **Jev** node this is matched against `DecisionResult.choice`.
   * - After any other node it must be empty (the edge is the default path).
   * - `default` / `else` / `*` is treated as a catch-all branch after Jev.
   */
  condition?: string;
}

/* -------------------------------------------------------------------------- */
/* Workflow                                                                   */
/* -------------------------------------------------------------------------- */

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  version: number;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt: string;
  updatedAt: string;
}

/** The part of a workflow the runtime actually needs. */
export type WorkflowDefinition = Pick<Workflow, 'nodes' | 'edges'>;

/** List-view projection of a workflow (no node payload). */
export interface WorkflowSummary {
  id: string;
  name: string;
  description?: string;
  version: number;
  nodeCount: number;
  edgeCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Default entry payload of a run. `{ input: "..." }` is the conventional shape. */
export interface WorkflowInput {
  input: unknown;
}
