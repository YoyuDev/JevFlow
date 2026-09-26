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
 */
export class JevNodeExecutor implements NodeExecutor {
  readonly type = 'jev' as const;

  async execute({ node, context, deps }: NodeExecutionInput): Promise<NodeExecutionOutput> {
    const config = resolveJevConfig(node);
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
      decision = await deps.jev.decide(question, config.choices, jevContext);
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
      },
      decision: resolved,
      meta: { client: deps.jev.name },
    };
  }
}
