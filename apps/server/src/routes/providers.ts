import type { FastifyInstance } from 'fastify';
import { createJevClient, createLLMClient, toErrorMessage } from '@jevflow/core';
import { HttpError } from '../errors.js';
import { isRecord, readString } from '../utils.js';

interface ProviderTestRequest {
  kind: 'llm' | 'jev';
  apiKey: string;
  baseUrl: string;
  model: string;
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
 * Structural problems are 400s; “the provider said no” is a 200 with `ok:false`.
 * An empty key is rejected up front because `createLLMClient` would silently
 * hand back the mock and the panel would report a green tick for nothing.
 */
function parseTestRequest(body: unknown): ProviderTestRequest {
  if (!isRecord(body)) {
    throw HttpError.badRequest('INVALID_BODY', 'Request body must be a JSON object');
  }

  const kind = readString(body['kind']);
  if (kind !== 'llm' && kind !== 'jev') {
    throw HttpError.badRequest('INVALID_KIND', '`kind` must be "llm" or "jev"', {
      allowed: ['llm', 'jev'],
    });
  }

  const apiKey = readString(body['apiKey'])?.trim() ?? '';
  const baseUrl = readString(body['baseUrl'])?.trim() ?? '';
  const model = readString(body['model'])?.trim() ?? '';

  if (!apiKey) {
    throw HttpError.badRequest('MISSING_API_KEY', 'An API key is required before testing');
  }
  if (kind === 'jev' && !baseUrl) {
    throw HttpError.badRequest('MISSING_BASE_URL', 'A Jev provider also needs a base URL');
  }

  return { kind, apiKey, baseUrl, model };
}

function preview(text: string, max = 120): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}
