import axios from 'axios';

export interface ApiErrorBody {
  error: { code: string; message: string; details?: Record<string, unknown> };
}

/** Every API failure surfaces as one of these. */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number | undefined;

  constructor(message: string, code = 'UNKNOWN', status?: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

export const http = axios.create({
  baseURL: '/api',
  timeout: 120_000,
  headers: { 'content-type': 'application/json' },
});

http.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const response = error.response;
      const body = response?.data as ApiErrorBody | undefined;
      const message = body?.error?.message ?? error.message;
      return Promise.reject(new ApiError(message, body?.error?.code ?? 'NETWORK_ERROR', response?.status));
    }
    return Promise.reject(error instanceof Error ? error : new ApiError(String(error)));
  },
);

/** Uniform message extraction for toast rendering. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return String(error);
}
