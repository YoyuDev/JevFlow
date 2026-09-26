export type WorkflowErrorCode =
  | 'INVALID_WORKFLOW'
  | 'INVALID_CONFIG'
  | 'START_NODE_NOT_FOUND'
  | 'NODE_NOT_FOUND'
  | 'EDGE_NOT_FOUND'
  | 'INVALID_DECISION'
  | 'LLM_FAILED'
  | 'JEV_FAILED'
  | 'TOOL_FAILED'
  | 'NODE_EXECUTION_FAILED'
  | 'MAX_STEPS_EXCEEDED';

/**
 * Every runtime failure is one of these, so a caller can branch on `code`
 * instead of parsing messages.
 */
export class WorkflowError extends Error {
  readonly code: WorkflowErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: WorkflowErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'WorkflowError';
    this.code = code;
    this.details = details;
  }
}

export function isWorkflowError(error: unknown): error is WorkflowError {
  return error instanceof WorkflowError;
}

/** Error → printable message, for `unknown` catch variables. */
export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/** Error → WorkflowError, so the engine can always record a stable code. */
export function toWorkflowError(error: unknown, fallbackCode: WorkflowErrorCode): WorkflowError {
  if (isWorkflowError(error)) return error;
  return new WorkflowError(fallbackCode, toErrorMessage(error));
}
