/**
 * Decision layer types.
 *
 * Jev is the decision engine of JevFlow: instead of generating text it picks
 * one label out of a fixed set of choices, based on the current workflow state.
 */

/** What a decision engine returns. */
export interface DecisionResult {
  /** Must be one of the choices handed to the client. */
  choice: string;
  /** 0..1 — how likely this choice is the right one. */
  probability?: number;
  /** 0..1 — how confident the engine is in its own answer. */
  confidence?: number;
  /** Optional human-readable justification, surfaced in the execution trace. */
  reason?: string;
}

/**
 * The decision contract. Everything (mock, real HTTP, your own engine) implements
 * it, so the Workflow Engine never knows how a decision was produced.
 */
export interface JevClient {
  /** Identifier shown in logs and in the Studio runtime badge. */
  readonly name: string;
  decide(question: string, choices: string[], context: unknown): Promise<DecisionResult>;
}

/** Shape of the context handed to `JevClient.decide`. */
export interface JevDecideContext {
  workflowId: string;
  nodeId: string;
  input: unknown;
  lastOutput: unknown;
  variables: Record<string, unknown>;
  nodeOutputs: Record<string, unknown>;
  extra?: string;
}
