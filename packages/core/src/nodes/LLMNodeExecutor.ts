import type { NodeExecutionInput, NodeExecutionOutput, NodeExecutor } from '../types/index.js';
import { toWorkflowError } from '../types/index.js';
import { interpolate } from '../utils/interpolate.js';
import { resolveLLMConfig } from './nodeConfig.js';

/**
 * Calls the configured LLM with a template-resolved prompt.
 *
 * Templates available: `{{input}}`, `{{last}}`, `{{<node-id>}}`, `{{<variable>}}`.
 * The raw text is kept in the `lastLLM` variable; the trace output is a small
 * object (`content` / `model` / `usage`) so the Studio can render it nicely.
 */
export class LLMNodeExecutor implements NodeExecutor {
  readonly type = 'llm' as const;

  async execute({ node, context, deps }: NodeExecutionInput): Promise<NodeExecutionOutput> {
    const config = resolveLLMConfig(node);
    const scope = context.buildScope({
      model: config.model,
      systemPrompt: config.systemPrompt ?? '',
    });

    const prompt = interpolate(config.prompt, scope).trim();
    const systemPrompt = config.systemPrompt ? interpolate(config.systemPrompt, scope).trim() : undefined;

    try {
      const response = await deps.llm.complete({
        prompt,
        ...(systemPrompt ? { systemPrompt } : {}),
        model: config.model,
        temperature: config.temperature,
        ...(config.maxTokens ? { maxTokens: config.maxTokens } : {}),
        context: {
          workflowId: context.workflowId,
          runId: context.runId,
          nodeId: node.id,
          variables: context.variables,
          nodeOutputs: context.nodeOutputs,
        },
      });

      context.setVariable('lastLLM', response.content);

      return {
        output: {
          content: response.content,
          model: response.model,
          usage: response.usage ?? null,
        },
        meta: { model: response.model, client: deps.llm.name },
      };
    } catch (error) {
      throw toWorkflowError(error, 'LLM_FAILED');
    }
  }
}
