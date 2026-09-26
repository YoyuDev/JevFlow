import type { ApiErrorBody } from './types.js';
import { WorkflowError } from '@jevflow/core';

/** Error with an HTTP status attached — thrown by routes and services. */
export class HttpError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(statusCode: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static badRequest(code: string, message: string, details?: Record<string, unknown>): HttpError {
    return new HttpError(400, code, message, details);
  }

  static notFound(message: string, details?: Record<string, unknown>): HttpError {
    return new HttpError(404, 'NOT_FOUND', message, details);
  }
}

const CLIENT_ERROR_CODES = new Set([
  'INVALID_WORKFLOW',
  'INVALID_CONFIG',
  'INVALID_DECISION',
  'START_NODE_NOT_FOUND',
  'NODE_NOT_FOUND',
  'EDGE_NOT_FOUND',
]);

/** Normalises anything thrown in a request into a status + JSON body. */
export function toApiError(error: unknown): { statusCode: number; body: ApiErrorBody } {
  if (error instanceof HttpError) {
    return {
      statusCode: error.statusCode,
      body: {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      },
    };
  }

  if (error instanceof WorkflowError) {
    const statusCode = CLIENT_ERROR_CODES.has(error.code) ? 400 : 500;
    return {
      statusCode,
      body: {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      },
    };
  }

  const message = error instanceof Error ? error.message : String(error);
  return {
    statusCode: 500,
    body: { error: { code: 'INTERNAL_ERROR', message } },
  };
}
