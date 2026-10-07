/**
 * JevFlow core — a decision-driven workflow runtime for AI agents.
 *
 * ```ts
 * import { WorkflowEngine } from '@jevflow/core';
 *
 * const engine = new WorkflowEngine();            // mock LLM + mock Jev
 * const result = await engine.run(workflow, { input: 'Hello JevFlow' });
 * console.log(result.status, result.trace);
 * ```
 */

/* ------------------------------- types ---------------------------------- */
export type {
  WorkflowNodeType,
  NodePosition,
  StartNodeConfig,
  LLMNodeConfig,
  JevNodeConfig,
  ToolNodeConfig,
  HttpNodeConfig,
  HttpMethod,
  EndNodeConfig,
  NodeConfigMap,
  NodeConfigOf,
  WorkflowNode,
  WorkflowEdge,
  Workflow,
  WorkflowDefinition,
  WorkflowSummary,
  WorkflowInput,
  DecisionResult,
  JevClient,
  JevDecideContext,
  LLMRequest,
  LLMUsage,
  LLMResponse,
  LLMClient,
  Tool,
  ToolRunContext,
  ToolRegistryLike,
  NodeExecutionStatus,
  ExecutionStatus,
  NodeExecutionRecord,
  WorkflowResult,
  WorkflowRunResult,
  RunOptions,
  EngineHooks,
  ExecutionContextLike,
  ExecutionContextSnapshot,
  NodeExecutor,
  NodeExecutorDeps,
  NodeProviderResolver,
  LLMProviderHandle,
  JevProviderHandle,
  ApiProviderHandle,
  NodeExecutionInput,
  NodeExecutionOutput,
  LogLevel,
  LogMeta,
  Logger,
  WorkflowErrorCode,
} from './types/index.js';
export { WorkflowError, isWorkflowError, toErrorMessage, toWorkflowError } from './types/index.js';

/* ------------------------------ constants ------------------------------- */
export {
  NODE_TYPES,
  DEFAULT_NODE_LABELS,
  CURRENT_WORKFLOW_VERSION,
  DEFAULT_MAX_STEPS,
  DEFAULT_LLM_MODEL,
  DEFAULT_LLM_PROMPT,
  DEFAULT_LLM_SYSTEM_PROMPT,
  DEFAULT_LLM_TEMPERATURE,
  DEFAULT_JEV_QUESTION,
  DEFAULT_JEV_CHOICES,
  DEFAULT_SEARCH_TOOL,
  DEFAULT_HTTP_METHOD,
  DEFAULT_HTTP_AUTH_HEADER,
  DEFAULT_HTTP_AUTH_SCHEME,
  DEFAULT_HTTP_TIMEOUT_MS,
  MAX_HTTP_TIMEOUT_MS,
  HTTP_METHODS,
  CATCH_ALL_CONDITIONS,
} from './constants.js';

/* -------------------------------- engine -------------------------------- */
export { WorkflowEngine } from './engine/index.js';
export type { WorkflowEngineOptions, WorkflowEngineCapabilities } from './engine/index.js';
export {
  validateWorkflow,
  findNode,
  findStartNode,
  outgoingEdges,
  incomingEdges,
  labelOf,
  isNodeType,
} from './engine/index.js';

/* -------------------------- decision (Jev layer) ------------------------- */
export { DecisionRouter, MockJevClient, RealJevClient, normalizeDecisionPayload } from './decision/index.js';
export type { MockJevClientOptions, RealJevClientOptions } from './decision/index.js';

/* ------------------------------ llm layer ------------------------------- */
export { MockLLMClient, RealLLMClient } from './llm/index.js';
export type { RealLLMClientOptions } from './llm/index.js';

/* ------------------------------ tool layer ------------------------------ */
export {
  ToolRegistry,
  MockSearchTool,
  createDefaultTools,
  createDefaultToolRegistry,
} from './tools/index.js';
export type { MockSearchResult } from './tools/index.js';

/* ------------------------------- executors ------------------------------ */
export {
  NodeExecutorRegistry,
  createDefaultNodeExecutors,
  StartNodeExecutor,
  LLMNodeExecutor,
  JevNodeExecutor,
  ToolNodeExecutor,
  HttpNodeExecutor,
  EndNodeExecutor,
  resolveLLMConfig,
  resolveJevConfig,
  resolveToolConfig,
  resolveHttpConfig,
  resolveEndConfig,
} from './nodes/index.js';
export type {
  ResolvedLLMConfig,
  ResolvedJevConfig,
  ResolvedToolConfig,
  ResolvedHttpConfig,
  HttpNodeExecutorOptions,
} from './nodes/index.js';

/* ------------------------------- execution ------------------------------ */
export { ExecutionContext, ExecutionTrace } from './execution/index.js';
export type { ExecutionContextInit } from './execution/index.js';

/* -------------------------------- config -------------------------------- */
export {
  createWorkflowEngine,
  createLLMClient,
  createJevClient,
  createToolRegistry,
} from './config/factory.js';
export type { JevFlowConfig, LLMClientConfig, JevClientConfig } from './config/factory.js';

/* ------------------------------ providers ------------------------------- */
export { ProviderRegistry } from './providers/index.js';
export type { ProviderProfileLike } from './providers/index.js';

/* --------------------------------- utils -------------------------------- */
export { interpolate, stringifyValue, extractTokens, resolvePath } from './utils/interpolate.js';
export { parseHeaderLines, findHeaderName } from './utils/headers.js';
export { formatValue, isRecord, truncate, cloneValue } from './utils/value.js';
export { ConsoleLogger, SilentLogger, createLogger } from './utils/logger.js';
export { createId } from './utils/id.js';
export type { FetchLike, FetchInit, FetchResponse } from './utils/fetch.js';
export { getDefaultFetch, safeReadText } from './utils/fetch.js';
