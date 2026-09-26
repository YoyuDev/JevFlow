import type { NodeExecutionInput, NodeExecutionOutput, NodeExecutor } from '../types/index.js';
import { WorkflowError, toWorkflowError } from '../types/index.js';
import { interpolate } from '../utils/interpolate.js';
import { resolveToolConfig } from './nodeConfig.js';

/**
 * Runs a registered tool.
 *
 * Args are template-resolved too, so a node can search for `{{input}}` today and
 * `{{llm-1}}`'s conclusion tomorrow without any code change.
 */
export class ToolNodeExecutor implements NodeExecutor {
  readonly type = 'tool' as const;

  async execute({ node, context, deps }: NodeExecutionInput): Promise<NodeExecutionOutput> {
    const config = resolveToolConfig(node);
    const tool = deps.tools.get(config.tool);

    if (!tool) {
      throw new WorkflowError('TOOL_FAILED', `Tool "${config.tool}" is not registered`, {
        nodeId: node.id,
        requested: config.tool,
        available: deps.tools.names(),
      });
    }

    const scope = context.buildScope();
    const args = resolveArgs(config.args, scope);
    const query = typeof args['query'] === 'string' ? args['query'] : '';
    if (query.trim().length === 0) {
      args['query'] = interpolate(config.query, scope).trim();
    }

    try {
      const output = await tool.run(args, {
        nodeId: node.id,
        workflowId: context.workflowId,
        input: scope['input'],
        variables: context.variables,
      });
      context.setVariable('lastTool', output);
      return { output, meta: { tool: tool.name } };
    } catch (error) {
      throw toWorkflowError(error, 'TOOL_FAILED');
    }
  }
}

/** Interpolates string args in place, leaves everything else untouched. */
function resolveArgs(args: Record<string, unknown>, scope: Record<string, unknown>): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    resolved[key] = typeof value === 'string' ? interpolate(value, scope) : value;
  }
  return resolved;
}
