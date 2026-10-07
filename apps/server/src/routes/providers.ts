import type { FastifyInstance } from 'fastify';
import {
  DEFAULT_HTTP_AUTH_HEADER,
  DEFAULT_HTTP_AUTH_SCHEME,
  createJevClient,
  createLLMClient,
  getDefaultFetch,
  parseHeaderLines,
  safeReadText,
  toErrorMessage,
} from '@jevflow/core';
import { HttpError } from '../errors.js';
import { isRecord, readString } from '../utils.js';

/** Probing someone else's API should not hang the settings dialog. */
const API_PROBE_TIMEOUT_MS = 8_000;

interface ProviderTestRequest {
  kind: 'llm' | 'jev' | 'api';
  apiKey: string;
  baseUrl: string;
  model: string;
  /** API connections only — extra headers, one `Name: value` per line. */
  headers: string;
  /** API connections only — header the key travels in. */
  authHeader: string;
  /** API connections only — prefix before the key. May legitimately be empty. */
  authScheme: string;
}

export interface ProviderTestResponse {
  ok: boolean;
  /** Which client answered. `mock-*` would mean the key was ignored — never reported as ok. */
  provider: string;
  latencyMs: number;
  model?: string;
  /** A short real response, so the user can see it is not just a 200. */
  sample?: string;
  error?: string;
}

/**
 *   POST /api/providers/test → do these credentials actually work?
 *
 * A failed check is a *result*, not a server error: the route answers 200 with
 * `{ ok: false }` so the settings panel can render the reason inline instead of
 * tripping the global error handler.
 */
export function registerProviderRoutes(app: FastifyInstance): void {
  app.post('/api/providers/test', async (request): Promise<ProviderTestResponse> => {
    const body = parseTestRequest(request.body);

    if (body.kind === 'api') return testApiConnection(body);

    const startedAt = Date.now();

    try {
      if (body.kind === 'llm') {
        const client = createLLMClient({
          apiKey: body.apiKey,
          ...(body.baseUrl ? { baseUrl: body.baseUrl } : {}),
          ...(body.model ? { model: body.model } : {}),
        });
        const response = await client.complete({
          prompt: 'Reply with the single word: pong',
          temperature: 0,
          maxTokens: 16,
        });
        return {
          ok: true,
          provider: client.name,
          latencyMs: Date.now() - startedAt,
          model: response.model,
          sample: preview(response.content),
        };
      }

      const client = createJevClient({
        apiKey: body.apiKey,
        baseUrl: body.baseUrl,
        ...(body.model ? { model: body.model } : {}),
      });
      const decision = await client.decide('Connectivity check', ['yes', 'no'], { probe: true });
      return {
        ok: true,
        provider: client.name,
        latencyMs: Date.now() - startedAt,
        ...(body.model ? { model: body.model } : {}),
        sample: decision.confidence === undefined
          ? decision.choice
          : `${decision.choice} · ${decision.confidence}`,
      };
    } catch (error) {
      return {
        ok: false,
        provider: body.kind === 'llm' ? 'llm' : 'jev',
        latencyMs: Date.now() - startedAt,
        error: toErrorMessage(error),
      };
    }
  });
}

/**
 * Probes an API connection by GET-ing its base URL.
 *
 * There is no universal “is this healthy” endpoint to call, so the honest test
 * is: can we reach the host, with the headers the workflow will really send?
 * A 2xx/3xx means good; a 4xx still proves we got through and is reported with
 * the status rather than as a network error — usually it means the Base URL is
 * missing a path segment, and saying so is more useful than “failed”.
 */
async function testApiConnection(body: ProviderTestRequest): Promise<ProviderTestResponse> {
  const startedAt = Date.now();
  const headers = buildProbeHeaders(body);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_PROBE_TIMEOUT_MS);

  try {
    const doFetch = getDefaultFetch();
    const response = await doFetch(body.baseUrl, { method: 'GET', headers, signal: controller.signal });
    const latencyMs = Date.now() - startedAt;
    const text = await safeReadText(response);

    if (!response.ok) {
      return {
        ok: false,
        provider: 'api',
        latencyMs,
        error: `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''} —— 请求发出去了，但根路径返回这个状态码。检查 Base URL 是否少了路径段。`,
      };
    }

    return {
      ok: true,
      provider: 'api',
      latencyMs,
      sample: preview(text) || `HTTP ${response.status}`,
    };
  } catch (error) {
    const timedOut = controller.signal.aborted;
    return {
      ok: false,
      provider: 'api',
      latencyMs: Date.now() - startedAt,
      error: timedOut ? `超时（${API_PROBE_TIMEOUT_MS}ms）` : toErrorMessage(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

function buildProbeHeaders(body: ProviderTestRequest): Record<string, string> {
  const headers = parseHeaderLines(body.headers);
  if (body.apiKey) {
    const name = body.authHeader.trim() || DEFAULT_HTTP_AUTH_HEADER;
    headers[name] = `${body.authScheme || DEFAULT_HTTP_AUTH_SCHEME}${body.apiKey}`;
  }
  return headers;
}

/**
 * Structural problems are 400s; “the provider said no” is a 200 with `ok:false`.
 * An empty key is rejected up front because `createLLMClient` would silently
 * hand back the mock and the panel would report a green tick for nothing. An
 * API connection may legitimately have no key at all, so only its URL is required.
 */
function parseTestRequest(body: unknown): ProviderTestRequest {
  if (!isRecord(body)) {
    throw HttpError.badRequest('INVALID_BODY', 'Request body must be a JSON object');
  }

  const kind = readString(body['kind']);
  if (kind !== 'llm' && kind !== 'jev' && kind !== 'api') {
    throw HttpError.badRequest('INVALID_KIND', '`kind` must be "llm", "jev" or "api"', {
      allowed: ['llm', 'jev', 'api'],
    });
  }

  const apiKey = readString(body['apiKey'])?.trim() ?? '';
  const baseUrl = readString(body['baseUrl'])?.trim() ?? '';
  const model = readString(body['model'])?.trim() ?? '';
  const headers = readString(body['headers']) ?? '';
  const authHeader = readString(body['authHeader'])?.trim() ?? '';
  const authScheme = typeof body['authScheme'] === 'string' ? body['authScheme'] : '';

  if (kind === 'api') {
    if (!baseUrl) {
      throw HttpError.badRequest('MISSING_BASE_URL', 'An API connection needs a base URL to test');
    }
    return { kind, apiKey, baseUrl, model, headers, authHeader, authScheme };
  }

  if (!apiKey) {
    throw HttpError.badRequest('MISSING_API_KEY', 'An API key is required before testing');
  }
  if (kind === 'jev' && !baseUrl) {
    throw HttpError.badRequest('MISSING_BASE_URL', 'A Jev provider also needs a base URL');
  }

  return { kind, apiKey, baseUrl, model, headers, authHeader, authScheme };
}

function preview(text: string, max = 120): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}
