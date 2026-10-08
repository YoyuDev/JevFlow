import type { DecisionResult } from './decision.js';
import type { Workflow, WorkflowNode, WorkflowNodeType } from './workflow.js';

/** Lifecycle status of one node execution attempt. */
export type NodeExecutionStatus = 'success' | 'failed' | 'skipped';

/** Lifecycle status of a whole workflow run. */
export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed';

/** One entry of the execution trace — what the Studio renders at the bottom. */
export interface NodeExecutionRecord {
  nodeId: string;
  nodeType: WorkflowNodeType;
  label: string;
  status: NodeExecutionStatus;
  /** What flowed into the node. */
  input: unknown;
  /** What the node produced. */
  output: unknown;
  /** Present on Jev nodes. */
  decision?: DecisionResult;
  probability?: number;
  confidence?: number;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  error?: string;
}

/** The minimal result contract. */
export interface WorkflowResult {
  status: 'completed' | 'failed';
  output: unknown;
  error?: string;
}

/** The full result of `WorkflowEngine.run()`. */
export interface WorkflowRunResult extends WorkflowResult {
  workflowId: string;
  runId: string;
  steps: number;
  trace: NodeExecutionRecord[];
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

/** Per-run overrides. */
export interface RunOptions {
  runId?: string;
  /** Hard stop for runaway loops. Defaults to the engine's `maxSteps`. */
  maxSteps?: number;
  /** Per-run hooks, merged over (and overriding) the engine-level hooks. */
  hooks?: EngineHooks;
}

/** Observability hooks — used by the server to log and persist as the run goes. */
export interface EngineHooks {
  onWorkflowStart?(payload: { workflow: Workflow; input: unknown; runId: string }): void;
  onNodeStart?(payload: { node: WorkflowNode; input: unknown; runId: string }): void;
  onNodeFinish?(payload: { node: WorkflowNode; record: NodeExecutionRecord; runId: string }): void;
  onWorkflowFinish?(payload: { result: WorkflowRunResult }): void;
}

/**
 * The read/write surface node executors get. `ExecutionContext` implements it;
 * declaring it here keeps the executor contract free of implementation imports.
 */
export interface ExecutionContextLike {
  readonly runId: string;
  readonly workflowId: string;
  readonly input: unknown;
  readonly lastOutput: unknown;
  readonly variables: Record<string, unknown>;
  readonly nodeOutputs: Record<string, unknown>;
  getNodeOutput(nodeId: string): unknown;
  /**
   * Records a node's output under its id.
   *
   * `asLastOutput: false` keeps it out of `lastOutput` — control-flow nodes use
   * this so a routing decision never masquerades as data (see
   * `NodeExecutor.controlFlow`).
   */
  setNodeOutput(nodeId: string, output: unknown, options?: { asLastOutput?: boolean }): void;
  getVariable(key: string): unknown;
  setVariable(key: string, value: unknown): void;
  /** Flat namespace used to resolve `{{token}}` templates. */
  buildScope(extra?: Record<string, unknown>): Record<string, unknown>;
  snapshot(): ExecutionContextSnapshot;
}

/** Serializable snapshot of a run's state. */
export interface ExecutionContextSnapshot {
  runId: string;
  workflowId: string;
  input: unknown;
  lastOutput: unknown;
  variables: Record<string, unknown>;
  nodeOutputs: Record<string, unknown>;
}
