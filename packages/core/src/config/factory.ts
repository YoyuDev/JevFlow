import { MockJevClient } from '../decision/MockJevClient.js';
import { RealJevClient } from '../decision/RealJevClient.js';
import { WorkflowEngine } from '../engine/WorkflowEngine.js';
import { MockLLMClient } from '../llm/MockLLMClient.js';
import { RealLLMClient } from '../llm/RealLLMClient.js';
import { ToolRegistry, createDefaultTools } from '../tools/index.js';
import type { JevClient, LLMClient, Logger, LogLevel, Tool } from '../types/index.js';
import { ConsoleLogger } from '../utils/logger.js';

export interface LLMClientConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export interface JevClientConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  path?: string;
}

export interface JevFlowConfig {
  llm?: LLMClientConfig;
  jev?: JevClientConfig;
  /** Extra tools merged on top of the built-in mock search. */
  tools?: Tool[];
  logger?: Logger;
  logLevel?: LogLevel;
  logScope?: string;
  maxSteps?: number;
  /** Ignore any credentials and stay fully offline. */
  forceMock?: boolean;
}

/**
 * Credentials in, client out.
 *
 * The rule everywhere in JevFlow: **no key means mock**, never a crash. That is
 * what makes `git clone && pnpm dev` work on a machine with no API keys at all.
 */
export function createLLMClient(config: LLMClientConfig = {}): LLMClient {
  const apiKey = config.apiKey?.trim();
  if (apiKey) {
    return new RealLLMClient({
      apiKey,
      ...(config.baseUrl?.trim() ? { baseUrl: config.baseUrl.trim() } : {}),
      ...(config.model?.trim() ? { model: config.model.trim() } : {}),
    });
  }
  return new MockLLMClient();
}

export function createJevClient(config: JevClientConfig = {}): JevClient {
  const apiKey = config.apiKey?.trim();
  const baseUrl = config.baseUrl?.trim();
  if (apiKey && baseUrl) {
    return new RealJevClient({
      apiKey,
      baseUrl,
      ...(config.model?.trim() ? { model: config.model.trim() } : {}),
      ...(config.path?.trim() ? { path: config.path.trim() } : {}),
    });
  }
  return new MockJevClient();
}

export function createToolRegistry(tools: readonly Tool[] = []): ToolRegistry {
  return new ToolRegistry([...createDefaultTools(), ...tools]);
}

export function createWorkflowEngine(config: JevFlowConfig = {}): WorkflowEngine {
  const logger = config.logger ?? new ConsoleLogger(config.logScope ?? 'jevflow', config.logLevel ?? 'info');
  const llm = config.forceMock ? new MockLLMClient() : createLLMClient(config.llm);
  const jev = config.forceMock ? new MockJevClient() : createJevClient(config.jev);

  logger.info('runtime initialised', {
    llm: llm.name,
    jev: jev.name,
    tools: createDefaultTools()
      .concat(config.tools ?? [])
      .map((tool) => tool.name),
  });

  return new WorkflowEngine({
    llm,
    jev,
    tools: createToolRegistry(config.tools ?? []),
    logger,
    ...(config.maxSteps ? { maxSteps: config.maxSteps } : {}),
  });
}
