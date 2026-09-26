/**
 * Minimal fetch surface, declared locally so `@jevflow/core` does not depend on
 * the DOM lib and callers can inject their own implementation (tests, proxies).
 *
 * `globalThis.fetch` (Node >= 18) satisfies it as-is.
 */
export interface FetchInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}

export interface FetchResponse {
  ok: boolean;
  status: number;
  statusText?: string;
  text(): Promise<string>;
  json(): Promise<unknown>;
}

export type FetchLike = (input: string, init?: FetchInit) => Promise<FetchResponse>;

export function getDefaultFetch(): FetchLike {
  const implementation = (globalThis as { fetch?: unknown }).fetch;
  if (typeof implementation !== 'function') {
    throw new Error('No global fetch available. Node >= 18 is required, or pass `fetchImpl`.');
  }
  return implementation.bind(globalThis) as FetchLike;
}

/** Reads a response body as text without ever throwing. */
export async function safeReadText(response: FetchResponse): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}
