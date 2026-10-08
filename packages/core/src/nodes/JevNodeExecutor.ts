import type {
  DecisionResult,
  JevDecideContext,
  NodeExecutionInput,
  NodeExecutionOutput,
  NodeExecutor,
} from '../types/index.js';
import { WorkflowError, toWorkflowError } from '../types/index.js';
import { interpolate } from '../utils/interpolate.js';
import { resolveJevConfig } from './nodeConfig.js';

/**
 * The heart of JevFlow.
 *
 * A Jev node does **not** generate text — it asks a decision engine a question
 * about the current state and gets back one label. The engine then routes on it.
 *
 * Output shape (also what the execution trace shows):
 * `{ question, choices, choice, probability, confidence, reason }`
 *
 * `config.providerId` picks a named decision connection out of `deps.providers`.
 *
 * Because the answer is a routing decision rather than data, this executor is
 * marked `controlFlow` — the engine keeps the result addressable as `{{jev-1}}`
 * but never lets it become the implicit `{{last}}` / End-node fallback.
 */
export class JevNodeExecutor implements NodeExecutor {
  readonly type = 'jev' as const;

  /** Decides *where to go*, not *what the data is*. See `NodeExecutor.controlFlow`. */
  readonly controlFlow = true;

  async execute({ node, context, deps }: NodeExecutionInput): Promise<NodeExecutionOutput> {
    const config = resolveJevConfig(node);
    const provider = config.providerId ? deps.providers?.jev(config.providerId) : undefined;
    const client = provider?.client ?? deps.jev;
    const scope = context.buildScope();
    const question = interpolate(config.question, scope).trim();

    let decision: DecisionResult;
    try {
      const extra = config.contextTemplate ? interpolate(config.contextTemplate, scope) : undefined;
      const jevContext: JevDecideContext = {
        workflowId: context.workflowId,
        nodeId: node.id,
        input: scope['input'],
        lastOutput: context.lastOutput,
        variables: context.variables,
        nodeOutputs: context.nodeOutputs,
        ...(extra ? { extra } : {}),
      };
      decision = await client.decide(question, config.choices, jevContext);
    } catch (error) {
      throw toWorkflowError(error, 'JEV_FAILED');
    }

    // Normalise the choice against the configured set (case-insensitive).
    const normalized = config.choices.find(
      (choice) => choice.toLowerCase() === decision.choice.trim().toLowerCase(),
    );
    if (!normalized) {
      throw new WorkflowError(
        'INVALID_DECISION',
        `Jev answered "${decision.choice}" but this node only allows: ${config.choices.join(', ')}`,
        { nodeId: node.id, choice: decision.choice, choices: config.choices },
      );
    }

    const resolved: DecisionResult = {
      choice: normalized,
      ...(decision.probability !== undefined ? { probability: decision.probability } : {}),
      ...(decision.confidence !== undefined ? { confidence: decision.confidence } : {}),
      ...(decision.reason ? { reason: decision.reason } : {}),
    };

    context.setVariable(`decision:${node.id}`, normalized);

    return {
      output: {
        question,
        choices: config.choices,
        choice: resolved.choice,
        probability: resolved.probability ?? null,
        confidence: resolved.confidence ?? null,
        reason: resolved.reason ?? null,
        ...(provider ? { provider: provider.label } : {}),
      },
      decision: resolved,
      meta: { client: client.name },
    };
  }
}
