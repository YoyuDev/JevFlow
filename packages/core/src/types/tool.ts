/** Tool layer types — anything a Tool node can call. */

export interface ToolRunContext {
  nodeId: string;
  workflowId: string;
  /** Resolved user input of the current run. */
  input: unknown;
  /** Current workflow variables. */
  variables: Record<string, unknown>;
}

export interface Tool {
  readonly name: string;
  readonly description: string;
  run(args: Record<string, unknown>, ctx: ToolRunContext): Promise<unknown>;
}

/** Read-only view of a tool registry (handy for dependency injection). */
export interface ToolRegistryLike {
  get(name: string): Tool | undefined;
  has(name: string): boolean;
  list(): Tool[];
  names(): string[];
}
