import type { Workflow, WorkflowSummary } from '@jevflow/core';
import { createId } from '@jevflow/core';
import type { ExecutionRepository } from '../database/ExecutionRepository.js';
import type {
  CreateWorkflowInput,
  UpdateWorkflowInput,
  WorkflowRepository,
} from '../database/WorkflowRepository.js';
import { HttpError } from '../errors.js';
import type { Runtime } from '../runtime/engineFactory.js';
import { createEngineWith } from '../runtime/engineFactory.js';
import type { ExecutionDetailResponse, RunProviderSelection, RunWorkflowResponse } from '../types.js';

export interface WorkflowServiceDeps {
  workflows: WorkflowRepository;
  executions: ExecutionRepository;
  runtime: Runtime;
}

/**
 * Business layer between the HTTP routes and (a) SQLite, (b) the workflow engine.
 *
 * Route handlers never touch a repository, and the engine never touches SQLite —
 * this class is the only place the two meet.
 */
export class WorkflowService {
  private readonly workflows: WorkflowRepository;
  private readonly executions: ExecutionRepository;
  private readonly runtime: Runtime;

  constructor(deps: WorkflowServiceDeps) {
    this.workflows = deps.workflows;
    this.executions = deps.executions;
    this.runtime = deps.runtime;
  }

  list(): WorkflowSummary[] {
    return this.workflows.list();
  }

  get(id: string): Workflow {
    const workflow = this.workflows.findById(id);
    if (!workflow) {
      throw HttpError.notFound(`Workflow "${id}" was not found`, { id });
    }
    return workflow;
  }

  create(input: CreateWorkflowInput): Workflow {
    return this.workflows.create(input);
  }

  update(id: string, patch: UpdateWorkflowInput): Workflow {
    const updated = this.workflows.update(id, patch);
    if (!updated) {
      throw HttpError.notFound(`Workflow "${id}" was not found`, { id });
    }
    return updated;
  }

  remove(id: string): void {
    const deleted = this.workflows.delete(id);
    if (!deleted) {
      throw HttpError.notFound(`Workflow "${id}" was not found`, { id });
    }
  }

  /**
   * Runs a workflow and persists the whole execution.
   *
   * Trace lines are written from the engine's `onNodeFinish` hook — so a run that
   * dies halfway still leaves a complete record of how far it got.
   *
   * `providers` carries the Studio's saved connections for this one run; when it
   * is present the engine is rebuilt so nodes can address them by id. Profiles
   * stay in memory — only `input` is written to SQLite, and a node config holds
   * nothing but the profile id.
   *
   * `onExecutionCreated` fires the instant the row exists, before the graph is
   * walked. That is what lets a public caller answer `202 Accepted` with an id
   * while the run is still in flight — the Studio never needs it and omits it.
   */
  async run(
    id: string,
    input: unknown,
    providers?: RunProviderSelection,
    options?: { onExecutionCreated?: (executionId: string) => void },
  ): Promise<RunWorkflowResponse> {
    const workflow = this.get(id);
    const executionId = createId('exec');
    const startedAt = new Date().toISOString();

    this.executions.createExecution({
      id: executionId,
      workflowId: workflow.id,
      input,
      startedAt,
    });

    options?.onExecutionCreated?.(executionId);

    const engine = providers
      ? createEngineWith(this.runtime.env, this.runtime.logger, providers)
      : this.runtime.engine;

    const result = await engine.run(workflow, input, {
      runId: executionId,
      hooks: {
        onNodeFinish: ({ record }) => {
          this.executions.insertNodeRecord(executionId, record);
        },
      },
    });

    const finishedAt = new Date().toISOString();
    this.executions.finishExecution({
      id: executionId,
      status: result.status,
      output: result.output,
      ...(result.error ? { error: result.error } : {}),
      steps: result.steps,
      finishedAt,
      durationMs: result.durationMs,
    });

    return {
      executionId,
      workflowId: workflow.id,
      status: result.status,
      output: result.output,
      ...(result.error ? { error: result.error } : {}),
      steps: result.steps,
      durationMs: result.durationMs,
      trace: result.trace,
    };
  }

  getExecution(executionId: string): ExecutionDetailResponse {
    const execution = this.executions.findExecution(executionId);
    if (!execution) {
      throw HttpError.notFound(`Execution "${executionId}" was not found`, { executionId });
    }
    return { execution, nodes: this.executions.listNodeRecords(executionId) };
  }

  listExecutions(workflowId: string, limit = 20): ExecutionDetailResponse['execution'][] {
    this.get(workflowId); // 404s early when the workflow does not exist
    return this.executions.listByWorkflow(workflowId, limit);
  }
}
