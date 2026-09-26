import type { JevClient, LLMClient, Logger, WorkflowEngine } from '@jevflow/core';
import {
  createJevClient,
  createLLMClient,
  createToolRegistry,
  WorkflowEngine as Engine,
} from '@jevflow/core';
import type { ServerEnv } from '../config/env.js';
import { SERVER_VERSION } from '../constants.js';
import type { RuntimeInfoResponse } from '../types.js';

export interface Runtime {
  engine: WorkflowEngine;
  llm: LLMClient;
  jev: JevClient;
  info: RuntimeInfoResponse;
}

/**
 * Wires credentials → clients → engine.
 *
 * Everything the engine needs is injected here; the engine itself imports
 * nothing from Fastify, SQLite or dotenv. That separation is what makes
 * `@jevflow/core` publishable on its own.
 */
export function createRuntime(env: ServerEnv, logger: Logger): Runtime {
  const llm = createLLMClient({
    apiKey: env.offline ? '' : env.llm.apiKey,
    baseUrl: env.llm.baseUrl,
    model: env.llm.model,
  });
  const jev = createJevClient({
    apiKey: env.offline ? '' : env.jev.apiKey,
    baseUrl: env.jev.baseUrl,
    model: env.jev.model,
  });
  const tools = createToolRegistry();

  const engine = new Engine({ llm, jev, tools, logger, hooks: {} });

  const info: RuntimeInfoResponse = {
    version: SERVER_VERSION,
    llm: { provider: llm.name, mock: llm.name.startsWith('mock') },
    jev: { provider: jev.name, mock: jev.name.startsWith('mock') },
    tools: tools.names(),
    nodeTypes: engine.nodeTypes,
    maxSteps: engine.capabilities.maxSteps,
    storage: { provider: 'sqlite', file: env.databaseFile },
  };

  return { engine, llm, jev, info };
}
