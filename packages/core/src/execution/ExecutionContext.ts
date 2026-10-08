import type { ExecutionContextLike, ExecutionContextSnapshot } from '../types/index.js';
import { isRecord } from '../utils/value.js';

export interface ExecutionContextInit {
  runId: string;
  workflowId: string;
  input: unknown;
}

/**
 * The mutable state of a single run.
 *
 * Two namespaces:
 *  - **node outputs** — keyed by node id, so templates can say `{{llm-1}}`.
 *  - **variables** — engine/node scratch space (`lastLLM`, `decision:jev-1`, ...).
 *
 * `buildScope()` flattens both (plus the entry input) into the namespace used to
 * resolve `{{token}}` templates.
 */
export class ExecutionContext implements ExecutionContextLike {
  readonly runId: string;
  readonly workflowId: string;
  readonly input: unknown;

  private readonly nodeOutputStore = new Map<string, unknown>();
  private readonly variableStore = new Map<string, unknown>();
  private currentOutput: unknown;

  constructor(init: ExecutionContextInit) {
    this.runId = init.runId;
    this.workflowId = init.workflowId;
    this.input = init.input;
    this.currentOutput = init.input;
  }

  /**
   * Output of the most recently executed **data** node (seeded with the run
   * input). Control-flow nodes do not update it — see `NodeExecutor.controlFlow`.
   */
  get lastOutput(): unknown {
    return this.currentOutput;
  }

  get variables(): Record<string, unknown> {
    return Object.fromEntries(this.variableStore.entries());
  }

  get nodeOutputs(): Record<string, unknown> {
    return Object.fromEntries(this.nodeOutputStore.entries());
  }

  /** Node ids that have produced an output so far, in execution order. */
  get executedNodeIds(): string[] {
    return [...this.nodeOutputStore.keys()];
  }

  getNodeOutput(nodeId: string): unknown {
    return this.nodeOutputStore.get(nodeId);
  }

  /**
   * Records a node's output under its id.
   *
   * By default it also becomes `lastOutput` — what `{{last}}` resolves to and
   * what an End node without an `output` template falls back to. Control-flow
   * nodes pass `asLastOutput: false` so their routing decision stays out of the
   * data flow. See `NodeExecutor.controlFlow`.
   */
  setNodeOutput(nodeId: string, output: unknown, options: { asLastOutput?: boolean } = {}): void {
    this.nodeOutputStore.set(nodeId, output);
    if (options.asLastOutput !== false) this.currentOutput = output;
  }

  getVariable(key: string): unknown {
    return this.variableStore.get(key);
  }

  setVariable(key: string, value: unknown): void {
    this.variableStore.set(key, value);
  }

  /**
   * Flat namespace for templates: entry input keys, then variables, then node
   * outputs (later entries win), plus `rawInput`, `input` and `last`.
   */
  buildScope(extra: Record<string, unknown> = {}): Record<string, unknown> {
    const raw = this.input;
    const scope: Record<string, unknown> = {};

    if (isRecord(raw)) Object.assign(scope, raw);

    scope['rawInput'] = raw;
    scope['input'] = isRecord(raw) && 'input' in raw ? raw['input'] : raw;

    for (const [key, value] of this.variableStore) scope[key] = value;
    for (const [key, value] of this.nodeOutputStore) scope[key] = value;
    scope['last'] = this.currentOutput;

    return { ...scope, ...extra };
  }

  snapshot(): ExecutionContextSnapshot {
    return {
      runId: this.runId,
      workflowId: this.workflowId,
      input: this.input,
      lastOutput: this.currentOutput,
      variables: this.variables,
      nodeOutputs: this.nodeOutputs,
    };
  }
}
