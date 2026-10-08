import type { NodeExecutionInput, NodeExecutionOutput, NodeExecutor } from '../types/index.js';
import { interpolate } from '../utils/interpolate.js';
import { resolveEndConfig } from './nodeConfig.js';

/**
 * Terminal node.
 *
 * Default behaviour: the workflow's output is whatever the previous **data**
 * node produced. Control-flow nodes (Jev) do not count — they decide where to
 * go, not what the answer is — so a Jev sitting right in front of End no longer
 * leaks its routing JSON into the result. Optionally the author can define an
 * `output` template to shape it.
 */
export class EndNodeExecutor implements NodeExecutor {
  readonly type = 'end' as const;

  async execute({ node, context }: NodeExecutionInput): Promise<NodeExecutionOutput> {
    const config = resolveEndConfig(node);
    const output = config.output ? interpolate(config.output, context.buildScope()) : context.lastOutput;

    return { output, meta: { final: true } };
  }
}
