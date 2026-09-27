/** Shared server-side shapes (the HTTP contract the Studio consumes). */

import type { DecisionResult, NodeExecutionRecord } from '@jevflow/core';

export interface WorkflowListResponse {
  workflows: import('@jevflow/core').WorkflowSummary[];
}

/** A single execution row. */
export interface ExecutionRecord {
  id: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed';
  input: unknown;
  output: unknown;
  error?: string | null;
  steps: number;
  startedAt: string;
  finishedAt?: string | null;
  durationMs?: number | null;
}

/** A single node execution row — one line of the execution trace. */
export interface NodeRunRecord {
  id: string;
  executionId: string;
  nodeId: string;
  nodeType: NodeExecutionRecord['nodeType'];
  label: string;
  status: NodeExecutionRecord['status'];
  input: unknown;
  output: unknown;
  decision?: DecisionResult | null;
  probability?: number | null;
  confidence?: number | null;
  error?: string | null;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

export interface ExecutionDetailResponse {
  execution: ExecutionRecord;
  nodes: NodeRunRecord[];
}

export interface RunWorkflowResponse {
  executionId: string;
  workflowId: string;
  status: 'completed' | 'failed';
  output: unknown;
  error?: string;
  steps: number;
  durationMs: number;
  trace: NodeExecutionRecord[];
}

export interface RuntimeInfoResponse {
  version: string;
  llm: { provider: string; mock: boolean };
  jev: { provider: string; mock: boolean };
  tools: string[];
  nodeTypes: string[];
  maxSteps: number;
  storage: { provider: 'sqlite'; file: string };
}

/** Credentials for one layer, exactly as the Studio sends them. */
export interface ProviderCredentials {
  apiKey: string;
  baseUrl: string;
  model: string;
}

/** One saved connection from the Studio's settings panel. */
export interface ProviderProfilePayload extends ProviderCredentials {
  id: string;
  kind: 'llm' | 'jev';
  /** Display name; used for trace labelling when present. */
  label?: string;
}

/**
 * Per-run providers coming from the Studio.
 *
 * Only the connections a workflow actually references are sent, and a node's
 * config carries nothing but a profile id — so an API key stays in the browser
 * until the moment a run needs it, and is never written to SQLite.
 */
export interface RunProviderSelection {
  profiles: ProviderProfilePayload[];
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/** Everything the route layer needs, assembled once in `index.ts`. */
export interface AppDeps {
  workflows: import('./services/WorkflowService.js').WorkflowService;
  executions: import('./services/ExecutionService.js').ExecutionService;
  runtime: RuntimeInfoResponse;
  /** Used by the error handler so 5xx responses are never swallowed. */
  logger: import('@jevflow/core').Logger;
}
