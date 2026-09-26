/**
 * `pnpm seed` — (re)writes the demo workflow.
 *
 * Idempotent: creates `research-agent` when missing, otherwise overwrites its
 * definition with the shipped one. Handy after editing `seed/demoWorkflow.ts`.
 */
import { ConsoleLogger } from '@jevflow/core';
import { env } from '../config/env.js';
import { createDatabase } from '../database/index.js';
import { WorkflowRepository } from '../database/WorkflowRepository.js';
import { createDemoWorkflow } from '../seed/demoWorkflow.js';

const logger = new ConsoleLogger('seed', env.logLevel);
const db = createDatabase(env.databaseFile);
const repository = new WorkflowRepository(db);
const demo = createDemoWorkflow();

try {
  if (repository.exists(demo.id)) {
    const updated = repository.update(demo.id, {
      name: demo.name,
      ...(demo.description !== undefined ? { description: demo.description } : {}),
      nodes: demo.nodes,
      edges: demo.edges,
    });
    logger.info('demo workflow updated', {
      workflowId: demo.id,
      version: updated?.version ?? null,
      nodes: demo.nodes.length,
      edges: demo.edges.length,
    });
  } else {
    const created = repository.create({
      id: demo.id,
      name: demo.name,
      ...(demo.description !== undefined ? { description: demo.description } : {}),
      nodes: demo.nodes,
      edges: demo.edges,
    });
    logger.info('demo workflow created', {
      workflowId: created.id,
      nodes: created.nodes.length,
      edges: created.edges.length,
    });
  }
  logger.info('seed finished', { database: env.databaseFile });
} finally {
  db.close();
}
