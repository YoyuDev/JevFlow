import { ConsoleLogger } from '@jevflow/core';
import { buildApp } from './app.js';
import { env } from './config/env.js';
import { createDatabase } from './database/index.js';
import { ExecutionRepository } from './database/ExecutionRepository.js';
import { WorkflowRepository } from './database/WorkflowRepository.js';
import { createRuntime } from './runtime/engineFactory.js';
import { ensureDemoWorkflow } from './seed/demoWorkflow.js';
import { ExecutionService } from './services/ExecutionService.js';
import { WorkflowService } from './services/WorkflowService.js';

async function main(): Promise<void> {
  const logger = new ConsoleLogger('server', env.logLevel);

  const db = createDatabase(env.databaseFile);
  const workflowRepository = new WorkflowRepository(db);
  const executionRepository = new ExecutionRepository(db);
  const runtime = createRuntime(env, logger);

  const seeded = ensureDemoWorkflow(workflowRepository, logger);

  const workflowService = new WorkflowService({
    workflows: workflowRepository,
    executions: executionRepository,
    runtime,
  });
  const executionService = new ExecutionService(executionRepository);

  const app = await buildApp({
    workflows: workflowService,
    executions: executionService,
    runtime: runtime.info,
    logger,
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info('shutting down', { signal });
    try {
      await app.close();
      db.close();
    } finally {
      process.exit(0);
    }
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ port: env.port, host: env.host });

  logger.info('JevFlow server ready', {
    url: `http://${env.host}:${env.port}`,
    llm: runtime.info.llm.provider,
    jev: runtime.info.jev.provider,
    tools: runtime.info.tools.join(','),
    database: env.databaseFile,
    offline: env.offline,
    demoWorkflowId: seeded?.id ?? null,
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
