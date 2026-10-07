import type { EndpointRecord, EndpointRepository } from '../database/EndpointRepository.js';
import { HttpError } from '../errors.js';
import type { Runtime } from '../runtime/engineFactory.js';
import type {
  AsyncRunAccepted,
  EndpointStatusResponse,
  ProviderProfilePayload,
  RunWorkflowResponse,
} from '../types.js';
import { createEndpointToken } from '../utils/crypto.js';
import type { ExecutionService } from './ExecutionService.js';
import type { WorkflowService } from './WorkflowService.js';

export interface EndpointServiceDeps {
  endpoints: EndpointRepository;
  workflows: WorkflowService;
  executions: ExecutionService;
  runtime: Runtime;
}

export interface PublishEndpointRequest {
  /** The connections the workflow references right now. `undefined` keeps the stored ones. */
  providers?: ProviderProfilePayload[];
  /** `true` → mint a fresh token, invalidating whatever was handed out before. */
  rotate?: boolean;
  /** Pause or resume an endpoint without throwing its token away. */
  enabled?: boolean;
}

/**
 * Turns a workflow into something another program can call.
 *
 * The Studio can already run a workflow, but only from a browser that holds the
 * API keys in `localStorage`. A published endpoint closes that gap: the caller
 * proves itself with a token, and the connections the run needs are kept here,
 * sealed on disk.
 *
 * Runs go through {@link WorkflowService.run} rather than re-implementing the
 * orchestration — same trace hooks, same execution rows, so a call from someone
 * else's code shows up in the Studio's history exactly like a local one.
 */
export class EndpointService {
  private readonly endpoints: EndpointRepository;
  private readonly workflows: WorkflowService;
  private readonly executions: ExecutionService;
  private readonly runtime: Runtime;

  constructor(deps: EndpointServiceDeps) {
    this.endpoints = deps.endpoints;
    this.workflows = deps.workflows;
    this.executions = deps.executions;
    this.runtime = deps.runtime;
  }

  /* ------------------------------- management ------------------------------ */

  /** `published: false` for a workflow that has never been exposed — not a 404. */
  status(workflowId: string): EndpointStatusResponse {
    const workflow = this.workflows.get(workflowId);
    const record = this.endpoints.findByWorkflow(workflowId);
    return this.toStatus(workflow.name, record);
  }

  publish(workflowId: string, request: PublishEndpointRequest): EndpointStatusResponse {
    const workflow = this.workflows.get(workflowId);
    const existing = this.endpoints.findByWorkflow(workflowId);

    const token = existing && !request.rotate ? existing.token : createEndpointToken();
    const providers = request.providers ?? existing?.providers ?? [];

    const record = this.endpoints.publish({ workflowId, token, providers });

    if (request.enabled !== undefined && request.enabled !== record.enabled) {
      const toggled = this.endpoints.setEnabled(workflowId, request.enabled);
      return this.toStatus(workflow.name, toggled ?? record);
    }
    return this.toStatus(workflow.name, record);
  }

  remove(workflowId: string): void {
    this.workflows.get(workflowId); // 404s when the workflow itself is gone
    if (!this.endpoints.remove(workflowId)) {
      throw HttpError.notFound(`Workflow "${workflowId}" is not published`, { workflowId });
    }
  }

  /** Every published endpoint, for the runtime banner. */
  publishedCount(): number {
    return this.endpoints.listAll().filter((item) => item.enabled).length;
  }

  /* --------------------------------- calling -------------------------------- */

  /**
   * Resolves a token to its endpoint.
   *
   * A bad token is 401 and a paused endpoint is 403, deliberately distinct: a
   * caller should be able to tell “my key is wrong” from “this was switched off”
   * without reading the logs.
   */
  authorize(token: string | undefined): EndpointRecord {
    const trimmed = token?.trim() ?? '';
    if (trimmed.length === 0) {
      throw new HttpError(401, 'MISSING_TOKEN', 'Provide the endpoint token in `x-api-key` or `Authorization: Bearer …`');
    }
    const record = this.endpoints.findByToken(trimmed);
    if (!record) {
      throw new HttpError(401, 'INVALID_TOKEN', 'This token does not match any published workflow');
    }
    if (!record.enabled) {
      throw new HttpError(403, 'ENDPOINT_DISABLED', 'This endpoint is paused; republish it from the Studio to resume');
    }
    return record;
  }

  /** Runs to completion and answers with the result — the default for callers. */
  async invoke(endpoint: EndpointRecord, input: unknown): Promise<RunWorkflowResponse> {
    try {
      const result = await this.workflows.run(endpoint.workflowId, input, providersOf(endpoint));
      this.endpoints.recordCall(endpoint.workflowId, result.status === 'completed');
      return result;
    } catch (error) {
      this.endpoints.recordCall(endpoint.workflowId, false);
      throw error;
    }
  }

  /**
   * Answers `202` with an execution id and lets the run finish in the
   * background. The result lands in the same `executions` table either way, so
   * the caller polls {@link getExecution} instead of holding a socket open.
   */
  async invokeAsync(endpoint: EndpointRecord, input: unknown): Promise<AsyncRunAccepted> {
    let resolveStarted: (executionId: string) => void = () => {};
    const started = new Promise<string>((resolve) => {
      resolveStarted = resolve;
    });

    const finished = this.workflows.run(endpoint.workflowId, input, providersOf(endpoint), {
      onExecutionCreated: (executionId) => resolveStarted(executionId),
    });

    // Nobody is awaiting `finished`; an unhandled rejection here would take the
    // process down. The row already records the failure, so a log line is enough.
    void finished.catch((error: unknown) => {
      this.runtime.logger.warn('background run failed', {
        workflowId: endpoint.workflowId,
        error: error instanceof Error ? error.message : String(error),
      });
    });
    void finished.then(
      (result) => this.endpoints.recordCall(endpoint.workflowId, result.status === 'completed'),
      () => this.endpoints.recordCall(endpoint.workflowId, false),
    );

    return { executionId: await started, workflowId: endpoint.workflowId, status: 'running' };
  }

  /** A caller may read an execution only through the token that can produce one. */
  getExecution(endpoint: EndpointRecord, executionId: string): import('../types.js').ExecutionDetailResponse {
    const detail = this.executions.get(executionId);
    if (detail.execution.workflowId !== endpoint.workflowId) {
      throw HttpError.notFound(`Execution "${executionId}" was not found`, { executionId });
    }
    return detail;
  }

  /* --------------------------------- helpers -------------------------------- */

  private toStatus(workflowName: string, record: EndpointRecord | undefined): EndpointStatusResponse {
    const { llm, jev, offline, host, port } = this.runtime.env;
    const shownHost = host === '0.0.0.0' || host === '::' ? 'localhost' : host;
    const baseUrl = `http://${shownHost}:${port}`;

    if (!record) {
      return {
        workflowId: '',
        workflowName,
        published: false,
        enabled: false,
        token: null,
        tokenHint: null,
        runUrl: null,
        baseUrl,
        providers: { count: 0, labels: [] },
        credentialsUnreadable: false,
        publishedAt: null,
        createdAt: null,
        callCount: 0,
        errorCount: 0,
        lastCalledAt: null,
        serverFallback: { llm: Boolean(llm.apiKey), jev: Boolean(jev.apiKey), offline },
      };
    }

    return {
      workflowId: record.workflowId,
      workflowName,
      published: true,
      enabled: record.enabled,
      token: record.token,
      tokenHint: `${record.token.slice(0, 8)}…`,
      runUrl: `${baseUrl}/api/v1/run`,
      baseUrl,
      providers: {
        count: record.providers.length,
        labels: record.providers.map((profile) => profile.label?.trim() || profile.id),
      },
      credentialsUnreadable: record.credentialsUnreadable,
      publishedAt: record.publishedAt,
      createdAt: record.createdAt,
      callCount: record.callCount,
      errorCount: record.errorCount,
      lastCalledAt: record.lastCalledAt,
      serverFallback: { llm: Boolean(llm.apiKey), jev: Boolean(jev.apiKey), offline },
    };
  }
}

/**
 * An endpoint with no stored connections runs on the server's own `.env`
 * clients — which is exactly what `undefined` means to `WorkflowService.run`.
 */
function providersOf(endpoint: EndpointRecord): { profiles: ProviderProfilePayload[] } | undefined {
  return endpoint.providers.length > 0 ? { profiles: endpoint.providers } : undefined;
}
