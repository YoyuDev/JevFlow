import type { JevClient, LLMClient, Logger, WorkflowEngine } from '@jevflow/core';
import {
  createJevClient,
  createLLMClient,
  createToolRegistry,
  ProviderRegistry,
  WorkflowEngine as Engine,
} from '@jevflow/core';
import type { ServerEnv } from '../config/env.js';
import { SERVER_VERSION } from '../constants.js';
import type { RunProviderSelection, RuntimeInfoResponse } from '../types.js';

export interface Runtime {
  engine: WorkflowEngine;
  llm: LLMClient;
  jev: JevClient;
  info: RuntimeInfoResponse;
  /** Retained so a single run can rebuild clients from Studio-supplied credentials. */
  env: ServerEnv;
  logger: Logger;
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

  return { engine, llm, jev, info, env, logger };
}

/* ----------------------------- per-run engine ----------------------------- */

/**
 * Builds a throwaway engine for a single run, carrying the Studio's connections.
 *
 * The boot-time `.env` clients stay in place as the **default** every node falls
 * back to; the profiles become named providers a node reaches by setting its
 * `config.providerId`. That is how two LLM nodes in one workflow can talk to two
 * different vendors without the server knowing anything about either of them up
 * front — and why the keys never touch the database.
 */
export function createEngineWith(
  env: ServerEnv,
  logger: Logger,
  selection: RunProviderSelection,
): WorkflowEngine {
  const fallback = env.offline
    ? { apiKey: '', baseUrl: '', model: '' }
    : { apiKey: env.llm.apiKey, baseUrl: env.llm.baseUrl, model: env.llm.model };
  const fallbackJev = env.offline
    ? { apiKey: '', baseUrl: '', model: '' }
    : { apiKey: env.jev.apiKey, baseUrl: env.jev.baseUrl, model: env.jev.model };

  return new Engine({
    llm: createLLMClient(fallback),
    jev: createJevClient(fallbackJev),
    tools: createToolRegistry(),
    providers: ProviderRegistry.from(selection.profiles),
    logger,
    hooks: {},
  });
}
