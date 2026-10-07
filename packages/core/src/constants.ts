import type { WorkflowNodeType } from './types/index.js';

/** All node types, in the order the Studio lists them. */
export const NODE_TYPES: readonly WorkflowNodeType[] = ['start', 'llm', 'jev', 'tool', 'http', 'end'];

export const DEFAULT_NODE_LABELS: Record<WorkflowNodeType, string> = {
  start: 'Start',
  llm: 'LLM',
  jev: 'Jev Decision',
  tool: 'Tool',
  http: 'HTTP Request',
  end: 'End',
};

export const CURRENT_WORKFLOW_VERSION = 1;

/** Runaway-loop guard. A workflow that needs more steps than this is a bug. */
export const DEFAULT_MAX_STEPS = 100;

/* ---------------------------------- LLM ---------------------------------- */

export const DEFAULT_LLM_MODEL = 'mock-model';
export const DEFAULT_LLM_PROMPT = '{{input}}';
export const DEFAULT_LLM_SYSTEM_PROMPT = '你是一个严谨、务实的助手。回答具体、结构清晰，不要说空话。';
export const DEFAULT_LLM_TEMPERATURE = 0.7;

/* ---------------------------------- Jev ---------------------------------- */

export const DEFAULT_JEV_QUESTION = '当前状态是否足以完成目标？';
export const DEFAULT_JEV_CHOICES: readonly string[] = ['complete', 'incomplete', 'invalid'];

/* ---------------------------------- Tool --------------------------------- */

export const DEFAULT_SEARCH_TOOL = 'search';

/* ---------------------------------- HTTP --------------------------------- */

/** Sensible default verb: most “call an API and read something” nodes are GETs. */
export const DEFAULT_HTTP_METHOD = 'GET';
/** Sent as `Authorization: <scheme><key>` unless the connection says otherwise. */
export const DEFAULT_HTTP_AUTH_HEADER = 'Authorization';
export const DEFAULT_HTTP_AUTH_SCHEME = 'Bearer ';
/** A request that hangs forever is worse than one that fails. */
export const DEFAULT_HTTP_TIMEOUT_MS = 15_000;
export const MAX_HTTP_TIMEOUT_MS = 120_000;

/** Verbs the editor offers. Anything else has to be typed into the workflow JSON. */
export const HTTP_METHODS: readonly string[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

/* -------------------------------- Routing -------------------------------- */

/** Conditions treated as a catch-all branch when no exact match is found. */
export const CATCH_ALL_CONDITIONS: readonly string[] = ['default', 'else', '*', 'any', 'fallback'];
