import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import { toApiError } from './errors.js';
import {
  registerExecutionRoutes,
  registerProviderRoutes,
  registerRuntimeRoutes,
  registerWorkflowRoutes,
} from './routes/index.js';
import type { AppDeps } from './types.js';

/**
 * Builds the HTTP app without starting it — which is what makes it testable.
 *
 * The engine, the repositories and the runtime info all arrive as `deps`; this
 * file wires routes and error handling and nothing else.
 */
export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: false, bodyLimit: 4 * 1024 * 1024 });

  // Fastify rejects `Content-Type: application/json` with an empty body, which
  // is exactly what `axios.delete()` and `curl -X DELETE -H ...` send. Treating
  // a blank body as `undefined` keeps body-less verbs working for every client.
  app.addContentTypeParser<string>('application/json', { parseAs: 'string' }, (_request, body, done) => {
    if (body === undefined || body === null || body.trim() === '') {
      done(null, undefined);
      return;
    }
    try {
      done(null, JSON.parse(body));
    } catch (error) {
      done(Object.assign(error as Error, { statusCode: 400 }), undefined);
    }
  });

  await app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  registerWorkflowRoutes(app, deps);
  registerExecutionRoutes(app, deps);
  registerRuntimeRoutes(app, deps);
  registerProviderRoutes(app);

  app.setNotFoundHandler((request, reply) => {
    void reply.code(404).send({
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: `${request.method} ${request.url} is not a JevFlow route`,
      },
    });
  });

  app.setErrorHandler((error, request, reply) => {
    const { statusCode, body } = toApiError(error);
    if (statusCode >= 500) {
      deps.logger.error('request failed', {
        method: request.method,
        url: request.url,
        code: body.error.code,
        error: body.error.message,
      });
    }
    void reply.code(statusCode).send(body);
  });

  return app;
}
