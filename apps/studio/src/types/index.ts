/** Studio-side mirror of the runtime contract (`@jevflow/core` + server API). */

export type NodeType = 'start' | 'llm' | 'jev' | 'tool' | 'end';

export interface NodePosition {
  x: number;
  y: number;
}

export interface WorkflowNode {
  id: string;
  type: NodeType;
  position: NodePosition;
  label?: string;
  config?: Record<string, unknown>;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  condition?: string;
}

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

export interface WorkflowPayload {
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

/* ------------------------------- executions ------------------------------ */

export type NodeRunStatus = 'success' | 'failed' | 'skipped';

export interface DecisionResult {
  choice: string;
  probability?: number;
  confidence?: number;
  reason?: string;
}

export interface TraceEntry {
  nodeId: string;
  nodeType: NodeType;
  label: string;
  status: NodeRunStatus;
  input: unknown;
  output: unknown;
  decision?: DecisionResult;
  probability?: number;
  confidence?: number;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  error?: string;
}

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

export interface ExecutionDetail {
  execution: ExecutionRecord;
  nodes: TraceEntry[];
}

export interface RunResponse {
  executionId: string;
  workflowId: string;
  status: 'completed' | 'failed';
  output: unknown;
  error?: string;
  steps: number;
  durationMs: number;
  trace: TraceEntry[];
}

/* --------------------------------- runtime -------------------------------- */

export interface RuntimeInfo {
  version: string;
  llm: { provider: string; mock: boolean };
  jev: { provider: string; mock: boolean };
  tools: string[];
  nodeTypes: NodeType[];
  maxSteps: number;
  storage: { provider: 'sqlite'; file: string };
}

/* ------------------------------- vue flow data ---------------------------- */

/**
 * Canvas-only state. `running` exists while a run is in flight and therefore
 * never shows up in a persisted trace entry — that is why the trace keeps the
 * narrower `NodeRunStatus`.
 */
export type NodeVisualStatus = NodeRunStatus | 'running';

/** `data` payload carried by every node on the canvas. */
export interface FlowNodeData {
  nodeType: NodeType;
  label: string;
  config: Record<string, unknown>;
  /** Filled in after a run so the canvas shows what happened. */
  runStatus?: NodeVisualStatus | null;
  [key: string]: unknown;
}

/**
 * Vue Flow's input `Node` type declares `data` as optional, but the Studio
 * always populates it. Narrowing it once here keeps every consumer free of
 * `node.data!` assertions.
 */
export type FlowNode = import('@vue-flow/core').Node<FlowNodeData> & { data: FlowNodeData };

/** A canvas edge. Vue Flow's `Edge` has no optional-data problem, so this is just an alias. */
export type FlowEdge = import('@vue-flow/core').Edge;
