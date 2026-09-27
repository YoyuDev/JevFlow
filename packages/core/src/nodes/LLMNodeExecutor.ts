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
 *
 * `config.providerId` picks a named connection out of `deps.providers` — that is
 * how two LLM nodes in the same workflow can talk to two different vendors.
 */
export class LLMNodeExecutor implements NodeExecutor {
  readonly type = 'llm' as const;

  async execute({ node, context, deps }: NodeExecutionInput): Promise<NodeExecutionOutput> {
    const config = resolveLLMConfig(node);
    const provider = config.providerId ? deps.providers?.llm(config.providerId) : undefined;
    const client = provider?.client ?? deps.llm;
    // Precedence: the node's own pin → the connection's model → the client default.
    const model = config.model ?? provider?.model;

    const scope = context.buildScope({
      model: model ?? '',
      systemPrompt: config.systemPrompt ?? '',
    });

    const prompt = interpolate(config.prompt, scope).trim();
    const systemPrompt = config.systemPrompt ? interpolate(config.systemPrompt, scope).trim() : undefined;

    try {
      const response = await client.complete({
        prompt,
        ...(systemPrompt ? { systemPrompt } : {}),
        ...(model ? { model } : {}),
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
          ...(provider ? { provider: provider.label } : {}),
        },
        meta: { model: response.model, client: client.name },
      };
    } catch (error) {
      throw toWorkflowError(error, 'LLM_FAILED');
    }
  }
}
