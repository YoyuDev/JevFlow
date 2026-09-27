import type { FastifyInstance } from 'fastify';
import { HttpError } from '../errors.js';
import { parseRunBody, parseWorkflowBody } from '../services/validation.js';
import type { AppDeps } from '../types.js';

/**
 * Workflow CRUD + run.
 *
 *   GET    /api/workflows
 *   GET    /api/workflows/:id
 *   POST   /api/workflows
 *   PUT    /api/workflows/:id
 *   DELETE /api/workflows/:id
 *   POST   /api/workflows/:id/run
 *   GET    /api/workflows/:id/executions
 */
export function registerWorkflowRoutes(app: FastifyInstance, deps: AppDeps): void {
  app.get('/api/workflows', async () => ({ workflows: deps.workflows.list() }));

  app.get('/api/workflows/:id', async (request) => {
    const { id } = request.params as { id: string };
    return { workflow: deps.workflows.get(id) };
  });

  app.post('/api/workflows', async (request, reply) => {
    const body = parseWorkflowBody(request.body);
    if (!body.name) {
      throw HttpError.badRequest('INVALID_NAME', '`name` is required when creating a workflow');
    }
    if (!body.nodes || !body.edges) {
      throw HttpError.badRequest(
        'INVALID_WORKFLOW',
        '`nodes` and `edges` are required when creating a workflow',
      );
    }

    const workflow = deps.workflows.create({
      name: body.name,
      ...(body.description !== undefined ? { description: body.description } : {}),
      nodes: body.nodes,
      edges: body.edges,
    });

    reply.code(201);
    return { workflow };
  });

  app.put('/api/workflows/:id', async (request) => {
    const { id } = request.params as { id: string };
    const body = parseWorkflowBody(request.body);

    const workflow = deps.workflows.update(id, {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.nodes !== undefined ? { nodes: body.nodes } : {}),
      ...(body.edges !== undefined ? { edges: body.edges } : {}),
    });

    return { workflow };
  });

  app.delete('/api/workflows/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    deps.workflows.remove(id);
    reply.code(204);
    return null;
  });

  app.post('/api/workflows/:id/run', async (request) => {
    const { id } = request.params as { id: string };
    const { input, providers } = parseRunBody(request.body);
    return deps.workflows.run(id, input, providers);
  });

  app.get('/api/workflows/:id/executions', async (request) => {
    const { id } = request.params as { id: string };
    const limit = readLimit(request.query, 20);
    return { executions: deps.workflows.listExecutions(id, limit) };
  });
}

function readLimit(query: unknown, fallback: number): number {
  if (!query || typeof query !== 'object') return fallback;
  const raw = (query as Record<string, unknown>)['limit'];
  const parsed = typeof raw === 'string' ? Number(raw) : typeof raw === 'number' ? raw : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), 100);
}
