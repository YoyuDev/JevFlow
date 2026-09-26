import type { ExecutionRepository } from '../database/ExecutionRepository.js';
import { HttpError } from '../errors.js';
import type { ExecutionDetailResponse, NodeRunRecord } from '../types.js';

/** Read-only side of executions, kept separate from the run path. */
export class ExecutionService {
  private readonly executions: ExecutionRepository;

  constructor(executions: ExecutionRepository) {
    this.executions = executions;
  }

  get(id: string): ExecutionDetailResponse {
    const execution = this.executions.findExecution(id);
    if (!execution) {
      throw HttpError.notFound(`Execution "${id}" was not found`, { id });
    }
    return { execution, nodes: this.executions.listNodeRecords(id) };
  }

  nodes(id: string): NodeRunRecord[] {
    const execution = this.executions.findExecution(id);
    if (!execution) {
      throw HttpError.notFound(`Execution "${id}" was not found`, { id });
    }
    return this.executions.listNodeRecords(id);
  }

  listByWorkflow(workflowId: string, limit = 20): ExecutionDetailResponse['execution'][] {
    return this.executions.listByWorkflow(workflowId, limit);
  }
}
