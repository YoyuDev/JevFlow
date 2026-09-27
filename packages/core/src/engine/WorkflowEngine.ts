import { DEFAULT_MAX_STEPS } from '../constants.js';
import { DecisionRouter } from '../decision/DecisionRouter.js';
import { MockJevClient } from '../decision/MockJevClient.js';
import { ExecutionContext } from '../execution/ExecutionContext.js';
import { ExecutionTrace } from '../execution/ExecutionTrace.js';
import { MockLLMClient } from '../llm/MockLLMClient.js';
import { NodeExecutorRegistry, createDefaultNodeExecutors } from '../nodes/NodeExecutorRegistry.js';
import { createDefaultToolRegistry } from '../tools/index.js';
import type {
  DecisionResult,
  EngineHooks,
  JevClient,
  LLMClient,
  LogMeta,
  Logger,
  NodeExecutionRecord,
  NodeExecutor,
  NodeExecutorDeps,
  NodeProviderResolver,
  RunOptions,
  ToolRegistryLike,
  Workflow,
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeType,
  WorkflowRunResult,
} from '../types/index.js';
import { WorkflowError, toWorkflowError } from '../types/index.js';
import { createId } from '../utils/id.js';
import { SilentLogger } from '../utils/logger.js';
import { findNode, findStartNode, labelOf, outgoingEdges, validateWorkflow } from './workflowGraph.js';

export interface WorkflowEngineOptions {
  /** Generation layer. Defaults to the offline `MockLLMClient`. */
  llm?: LLMClient;
  /** Decision layer. Defaults to the offline `MockJevClient`. */
  jev?: JevClient;
  /** Tool layer. Defaults to a registry holding the mock search tool. */
  tools?: ToolRegistryLike;
  /** Extra / replacement node executors. */
  executors?: NodeExecutor[];
  /** Outgoing-edge resolution. Defaults to a fresh `DecisionRouter`. */
  router?: DecisionRouter;
  /**
   * Named providers a node may point at through `config.providerId`.
   * Omit it and every node uses the engine's default `llm` / `jev`.
   */
  providers?: NodeProviderResolver;
  logger?: Logger;
  /** Runaway-loop guard. Defaults to 100 steps. */
  maxSteps?: number;
  /** Default observability hooks (can be overridden per run). */
  hooks?: EngineHooks;
}

export interface WorkflowEngineCapabilities {
  llm: string;
  jev: string;
  tools: string[];
  nodeTypes: WorkflowNodeType[];
  maxSteps: number;
  /** True when both the LLM and the decision layer are offline mocks. */
  mock: boolean;
}

interface ExecutionAttempt {
  output: unknown;
  decision?: DecisionResult;
  error?: WorkflowError;
}

/**
 * Sequential workflow runtime.
 *
 *   find Start → execute → trace → pick next edge → repeat → reach End
 *
 * After a **Jev** node the next edge comes from the decision; after any other
 * node it is the node's single/default outgoing edge.
 *
 * No DAG scheduling, no parallelism, no distributed anything — by design.
 * It depends on nothing but the four abstractions above, which is why it can be
 * published as `@jevflow/core` and embedded in any Node.js project.
 */
export class WorkflowEngine {
  private readonly llm: LLMClient;
  private readonly jev: JevClient;
  private readonly tools: ToolRegistryLike;
  private readonly logger: Logger;
  private readonly router: DecisionRouter;
  private readonly executors: NodeExecutorRegistry;
  private readonly providers: NodeProviderResolver | undefined;
  private readonly maxSteps: number;
  private hooks: EngineHooks;

  constructor(options: WorkflowEngineOptions = {}) {
    this.llm = options.llm ?? new MockLLMClient();
    this.jev = options.jev ?? new MockJevClient();
    this.tools = options.tools ?? createDefaultToolRegistry();
    this.logger = options.logger ?? new SilentLogger();
    this.router = options.router ?? new DecisionRouter();
    this.executors = new NodeExecutorRegistry(options.executors ?? createDefaultNodeExecutors());
    this.providers = options.providers;
    this.maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS;
    this.hooks = options.hooks ?? {};
  }

  get capabilities(): WorkflowEngineCapabilities {
    return {
      llm: this.llm.name,
      jev: this.jev.name,
      tools: this.tools.names(),
      nodeTypes: this.executors.types(),
      maxSteps: this.maxSteps,
      mock: this.llm.name.startsWith('mock') && this.jev.name.startsWith('mock'),
    };
  }

  get nodeTypes(): WorkflowNodeType[] {
    return this.executors.types();
  }

  get toolNames(): string[] {
    return this.tools.names();
  }

  /** Replaces the default hooks (e.g. the server attaches persistence here). */
  setHooks(hooks: EngineHooks): void {
    this.hooks = hooks;
  }

  registerExecutor(executor: NodeExecutor): void {
    this.executors.register(executor);
  }

  async run(workflow: Workflow, input: unknown, options: RunOptions = {}): Promise<WorkflowRunResult> {
    const runId = options.runId ?? createId('run');
    const maxSteps = options.maxSteps ?? this.maxSteps;
    const hooks: EngineHooks = { ...this.hooks, ...options.hooks };
    const startedAt = new Date();
    const workflowId = workflow?.id ?? 'unknown';
    const context = new ExecutionContext({ runId, workflowId, input });
    const trace = new ExecutionTrace();
    const baseMeta: LogMeta = { workflowId, runId };

    // ---- validate ---------------------------------------------------------
    let failure: WorkflowError | undefined;
    try {
      validateWorkflow(workflow);
    } catch (error) {
      failure = toWorkflowError(error, 'INVALID_WORKFLOW');
    }

    const startNode = failure ? undefined : findStartNode(workflow);
    if (!failure && !startNode) {
      failure = new WorkflowError('START_NODE_NOT_FOUND', 'Workflow has no Start node', { workflowId });
    }

    if (failure || !startNode) {
      const error = failure ?? new WorkflowError('INVALID_WORKFLOW', 'Workflow cannot be executed');
      this.logger.error('workflow run aborted before start', {
        ...baseMeta,
        code: error.code,
        error: error.message,
      });
      return this.buildResult({
        workflowId,
        runId,
        status: 'failed',
        output: null,
        trace,
        steps: 0,
        startedAt,
        error: error.message,
      });
    }

    hooks.onWorkflowStart?.({ workflow, input, runId });
    this.logger.info('workflow run started', {
      ...baseMeta,
      name: workflow.name,
      nodes: workflow.nodes.length,
      edges: workflow.edges.length,
      maxSteps,
    });

    // ---- execute ----------------------------------------------------------
    let current: WorkflowNode = startNode;
    let steps = 0;
    let finalOutput: unknown = null;

    while (!failure) {
      if (steps >= maxSteps) {
        failure = new WorkflowError(
          'MAX_STEPS_EXCEEDED',
          `Workflow exceeded the maximum of ${maxSteps} steps`,
          { ...baseMeta, steps },
        );
        break;
      }
      steps += 1;

      const node = current;
      const label = labelOf(node);
      const nodeInput = node.type === 'start' ? context.input : context.lastOutput;
      const nodeStartedAt = new Date().toISOString();
      const nodeStartMs = Date.now();

      hooks.onNodeStart?.({ node, input: nodeInput, runId });

      const attempt: ExecutionAttempt = { output: null };
      try {
        const executor = this.executors.mustGet(node.type);
        const result = await executor.execute({ node, context, deps: this.deps() });
        attempt.output = result.output;
        if (result.decision) attempt.decision = result.decision;
      } catch (error) {
        attempt.error = toWorkflowError(error, 'NODE_EXECUTION_FAILED');
      }

      let nextNode: WorkflowNode | undefined;
      if (!attempt.error) {
        context.setNodeOutput(node.id, attempt.output);
        if (node.type === 'end') {
          finalOutput = attempt.output;
        } else {
          try {
            nextNode = this.resolveNextNode(node, attempt, workflow);
          } catch (error) {
            attempt.error = toWorkflowError(error, 'EDGE_NOT_FOUND');
          }
        }
      }

      const record: NodeExecutionRecord = {
        nodeId: node.id,
        nodeType: node.type,
        label,
        status: attempt.error ? 'failed' : 'success',
        input: nodeInput,
        output: attempt.error && attempt.output === null ? null : attempt.output,
        startedAt: nodeStartedAt,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - nodeStartMs,
      };
      if (attempt.decision) {
        record.decision = attempt.decision;
        record.probability = attempt.decision.probability;
        record.confidence = attempt.decision.confidence;
      }
      if (attempt.error) record.error = attempt.error.message;

      trace.add(record);
      hooks.onNodeFinish?.({ node, record, runId });
      this.logNode(baseMeta, record);

      if (attempt.error) {
        failure = attempt.error;
        break;
      }
      if (!nextNode) break;
      current = nextNode;
    }

    const result = this.buildResult({
      workflowId,
      runId,
      status: failure ? 'failed' : 'completed',
      output: failure ? null : finalOutput,
      trace,
      steps,
      startedAt,
      ...(failure ? { error: failure.message } : {}),
    });

    hooks.onWorkflowFinish?.({ result });
    this.logger.info('workflow run finished', {
      ...baseMeta,
      status: result.status,
      steps,
      durationMs: result.durationMs,
      ...(failure ? { code: failure.code, error: failure.message } : {}),
    });

    return result;
  }

  /** Picks the edge (and therefore the next node) after a successful node. */
  private resolveNextNode(node: WorkflowNode, attempt: ExecutionAttempt, workflow: Workflow): WorkflowNode {
    const edges = outgoingEdges(workflow, node.id);
    if (edges.length === 0) {
      throw new WorkflowError(
        'EDGE_NOT_FOUND',
        `Node "${node.id}" (${node.type}) has no outgoing edge and is not an End node`,
        { nodeId: node.id, nodeType: node.type },
      );
    }

    let edge: WorkflowEdge;
    if (node.type === 'jev') {
      if (!attempt.decision) {
        throw new WorkflowError('INVALID_DECISION', `Jev node "${node.id}" produced no decision`, {
          nodeId: node.id,
        });
      }
      edge = this.router.route(attempt.decision, edges, node.id);
      this.logger.debug('decision routed', {
        workflowId: workflow.id,
        nodeId: node.id,
        choice: attempt.decision.choice,
        target: edge.target,
      });
    } else {
      edge = this.router.routeDefault(edges, node.id);
    }

    const target = findNode(workflow, edge.target);
    if (!target) {
      throw new WorkflowError('NODE_NOT_FOUND', `Edge "${edge.id}" points to unknown node "${edge.target}"`, {
        edgeId: edge.id,
        target: edge.target,
      });
    }
    return target;
  }

  private deps(): NodeExecutorDeps {
    return {
      llm: this.llm,
      jev: this.jev,
      tools: this.tools,
      logger: this.logger,
      ...(this.providers ? { providers: this.providers } : {}),
    };
  }

  private buildResult(params: {
    workflowId: string;
    runId: string;
    status: 'completed' | 'failed';
    output: unknown;
    trace: ExecutionTrace;
    steps: number;
    startedAt: Date;
    error?: string;
  }): WorkflowRunResult {
    const finishedAt = new Date();
    return {
      workflowId: params.workflowId,
      runId: params.runId,
      status: params.status,
      output: params.output,
      ...(params.error ? { error: params.error } : {}),
      steps: params.steps,
      trace: params.trace.all,
      startedAt: params.startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - params.startedAt.getTime(),
    };
  }

  private logNode(baseMeta: LogMeta, record: NodeExecutionRecord): void {
    const meta: LogMeta = {
      ...baseMeta,
      nodeId: record.nodeId,
      nodeType: record.nodeType,
      status: record.status,
      durationMs: record.durationMs,
    };
    if (record.decision) meta['decision'] = record.decision.choice;
    if (record.probability !== undefined) meta['probability'] = record.probability;
    if (record.confidence !== undefined) meta['confidence'] = record.confidence;
    if (record.error) meta['error'] = record.error;

    if (record.status === 'failed') this.logger.error('node failed', meta);
    else this.logger.info('node executed', meta);
  }
}
