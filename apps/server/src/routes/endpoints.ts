import type { FastifyInstance } from 'fastify';
import { parseEndpointBody } from '../services/validation.js';
import type { AppDeps } from '../types.js';

/**
 *   GET    /api/workflows/:id/endpoint → is it published, and how is it doing?
 *   POST   /api/workflows/:id/endpoint → publish / refresh / pause / rotate
 *   DELETE /api/workflows/:id/endpoint → revoke for good
 *
 * One route for everything that is not deletion: publishing, refreshing the
 * credential snapshot, pausing and rotating a token are all “change the one
 * endpoint this workflow has”, and splitting them into four verbs would only
 * scatter the same body parser.
 */
export function registerEndpointRoutes(app: FastifyInstance, deps: AppDeps): void {
  app.get('/api/workflows/:id/endpoint', async (request) => {
    const { id } = request.params as { id: string };
    return { endpoint: deps.endpoints.status(id) };
  });

  app.post('/api/workflows/:id/endpoint', async (request) => {
    const { id } = request.params as { id: string };
    const body = parseEndpointBody(request.body);
    return { endpoint: deps.endpoints.publish(id, body) };
  });

  app.delete('/api/workflows/:id/endpoint', async (request, reply) => {
    const { id } = request.params as { id: string };
    deps.endpoints.remove(id);
    reply.code(204);
    return null;
  });
}
