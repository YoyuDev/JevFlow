import type { NodeExecutionInput, NodeExecutionOutput, NodeExecutor } from '../types/index.js';

/**
 * Entry point of a workflow.
 *
 * Its only job: publish the run input as the first value on the wire. No config,
 * nothing to fail.
 */
export class StartNodeExecutor implements NodeExecutor {
  readonly type = 'start' as const;

  async execute({ context }: NodeExecutionInput): Promise<NodeExecutionOutput> {
    return {
      output: context.input,
      meta: { entry: true },
    };
  }
}
