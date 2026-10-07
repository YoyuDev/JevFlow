import type { FastifyInstance, FastifyRequest } from 'fastify';
import { HttpError } from '../errors.js';
import { parseRunBody } from '../services/validation.js';
import type { AppDeps } from '../types.js';

/**
 * The published surface — the part of the server other people's code talks to.
 *
 *   POST /api/v1/run            → run the workflow this token belongs to
 *   GET  /api/v1/executions/:id → poll a run started with `?mode=async`
 *   GET  /api/v1/health         → unauthenticated liveness probe
 *
 * Kept apart from `/api/*` on purpose. The internal routes assume that whoever
 * reached the port is the owner; these assume nothing and authenticate with an
 * endpoint token instead.
 */
export function registerPublicRoutes(app: FastifyInstance, deps: AppDeps): void {
  app.get('/api/v1/health', async () => ({
    ok: true,
    version: deps.runtime.version,
    llm: deps.runtime.llm.provider,
    jev: deps.runtime.jev.provider,
  }));

  app.post('/api/v1/run', async (request, reply) => {
    const endpoint = deps.endpoints.authorize(readToken(request));

    // The same body grammar as the internal run route, minus `providers`: a
    // caller outside the Studio has no business naming connections, and the
    // sealed snapshot on the server is the whole point of publishing.
    const { input } = parseRunBody(request.body);

    if (readMode(request) === 'async') {
      reply.code(202);
      return deps.endpoints.invokeAsync(endpoint, input);
    }

    const result = await deps.endpoints.invoke(endpoint, input);
    return {
      executionId: result.executionId,
      workflowId: result.workflowId,
      status: result.status,
      output: result.output,
      ...(result.error ? { error: result.error } : {}),
      steps: result.steps,
      durationMs: result.durationMs,
    };
  });

  app.get('/api/v1/executions/:id', async (request) => {
    const endpoint = deps.endpoints.authorize(readToken(request));
    const { id } = request.params as { id: string };
    const { execution } = deps.endpoints.getExecution(endpoint, id);

    return {
      executionId: execution.id,
      workflowId: execution.workflowId,
      status: execution.status,
      output: execution.output,
      ...(execution.error ? { error: execution.error } : {}),
      steps: execution.steps,
      startedAt: execution.startedAt,
      finishedAt: execution.finishedAt ?? null,
      durationMs: execution.durationMs ?? null,
    };
  });
}

/**
 * `x-api-key` is the documented header; `Authorization: Bearer` is accepted
 * because every HTTP client in existence already knows how to set it.
 */
function readToken(request: FastifyRequest): string | undefined {
  const header = request.headers['x-api-key'];
  const direct = Array.isArray(header) ? header[0] : header;
  if (typeof direct === 'string' && direct.trim().length > 0) return direct.trim();

  const authorization = request.headers['authorization'];
  const raw = Array.isArray(authorization) ? authorization[0] : authorization;
  if (typeof raw === 'string') {
    const match = /^Bearer\s+(.+)$/i.exec(raw.trim());
    if (match?.[1]) return match[1].trim();
  }
  return undefined;
}

function readMode(request: FastifyRequest): 'sync' | 'async' {
  const query = request.query;
  if (!query || typeof query !== 'object') return 'sync';
  const raw = (query as Record<string, unknown>)['mode'];
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (value === 'async') return 'async';
  if (value === '' || value === 'sync') return 'sync';
  throw HttpError.badRequest('INVALID_MODE', '`mode` must be "sync" or "async"', {
    allowed: ['sync', 'async'],
  });
}
