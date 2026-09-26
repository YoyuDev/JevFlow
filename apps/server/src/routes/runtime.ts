import type { FastifyInstance } from 'fastify';
import { SERVER_VERSION } from '../constants.js';
import type { AppDeps } from '../types.js';

/**
 *   GET /api/runtime        → which LLM / Jev / tools are active (mock or real)
 *   GET /api/health         → liveness probe
 *   GET /api/node-types     → node palette + available tools
 */
export function registerRuntimeRoutes(app: FastifyInstance, deps: AppDeps): void {
  app.get('/api/runtime', async () => deps.runtime);

  app.get('/api/health', async () => ({
    status: 'ok',
    version: SERVER_VERSION,
    uptimeMs: Math.round(process.uptime() * 1000),
  }));

  app.get('/api/node-types', async () => ({
    nodeTypes: deps.runtime.nodeTypes,
    tools: deps.runtime.tools,
  }));
}
