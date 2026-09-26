import type { FastifyInstance } from 'fastify';
import type { AppDeps } from '../types.js';

/**
 *   GET /api/executions/:id         → execution + full node trace
 *   GET /api/executions/:id/nodes   → node trace only
 */
export function registerExecutionRoutes(app: FastifyInstance, deps: AppDeps): void {
  app.get('/api/executions/:id', async (request) => {
    const { id } = request.params as { id: string };
    return deps.executions.get(id);
  });

  app.get('/api/executions/:id/nodes', async (request) => {
    const { id } = request.params as { id: string };
    return { nodes: deps.executions.nodes(id) };
  });
}
