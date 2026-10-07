import {
  DEFAULT_HTTP_METHOD,
  DEFAULT_HTTP_TIMEOUT_MS,
  DEFAULT_JEV_CHOICES,
  DEFAULT_JEV_QUESTION,
  DEFAULT_LLM_MODEL,
  DEFAULT_LLM_PROMPT,
  DEFAULT_LLM_TEMPERATURE,
  DEFAULT_SEARCH_TOOL,
  HTTP_METHODS,
  MAX_HTTP_TIMEOUT_MS,
} from '../constants.js';
import type {
  EndNodeConfig,
  HttpMethod,
  HttpNodeConfig,
  JevNodeConfig,
  LLMNodeConfig,
  ToolNodeConfig,
  WorkflowNode,
} from '../types/index.js';
import { parseHeaderLines } from '../utils/headers.js';
import { readBoolean, readNumber, readRecord, readString, readStringArray } from '../utils/value.js';

/**
 * Config readers.
 *
 * Workflow JSON is untrusted input, so every executor resolves its config
 * through these functions: defaults are always present, types are always right,
 * and nothing downstream has to deal with `unknown`.
 */

export interface ResolvedLLMConfig {
  /** Which named provider to use. `undefined` → the engine default. */
  providerId?: string;
  /** Explicit model pin. `undefined` → the provider's model, then the client default. */
  model?: string;
  prompt: string;
  systemPrompt?: string;
  temperature: number;
  maxTokens?: number;
}

export function resolveLLMConfig(node: WorkflowNode): ResolvedLLMConfig {
  const config = node.config;
  const resolved: ResolvedLLMConfig = {
    prompt: readString(config, 'prompt') ?? DEFAULT_LLM_PROMPT,
    temperature: readNumber(config, 'temperature') ?? DEFAULT_LLM_TEMPERATURE,
  };
  const providerId = readString(config, 'providerId')?.trim();
  if (providerId) resolved.providerId = providerId;
  // `mock-model` is the placeholder a node starts life with — it means "no
  // opinion", not "ask for a model literally named mock-model".
  const model = readString(config, 'model')?.trim();
  if (model && model !== DEFAULT_LLM_MODEL) resolved.model = model;
  const systemPrompt = readString(config, 'systemPrompt');
  if (systemPrompt) resolved.systemPrompt = systemPrompt;
  const maxTokens = readNumber(config, 'maxTokens');
  if (maxTokens) resolved.maxTokens = maxTokens;
  return resolved;
}

/** The typed config shape, for callers that want to build nodes in code. */
export type { LLMNodeConfig };

export interface ResolvedJevConfig {
  /** Which named provider to use. `undefined` → the engine default. */
  providerId?: string;
  question: string;
  choices: string[];
  contextTemplate?: string;
}

export function resolveJevConfig(node: WorkflowNode): ResolvedJevConfig {
  const config = node.config;
  const choices = readStringArray(config, 'choices') ?? [...DEFAULT_JEV_CHOICES];
  const resolved: ResolvedJevConfig = {
    question: readString(config, 'question') ?? DEFAULT_JEV_QUESTION,
    choices,
  };
  const providerId = readString(config, 'providerId')?.trim();
  if (providerId) resolved.providerId = providerId;
  const contextTemplate = readString(config, 'contextTemplate');
  if (contextTemplate) resolved.contextTemplate = contextTemplate;
  return resolved;
}

export type { JevNodeConfig };

export interface ResolvedToolConfig {
  tool: string;
  query: string;
  args: Record<string, unknown>;
}

export function resolveToolConfig(node: WorkflowNode): ResolvedToolConfig {
  const config = node.config;
  return {
    tool: readString(config, 'tool') ?? DEFAULT_SEARCH_TOOL,
    query: readString(config, 'query') ?? DEFAULT_LLM_PROMPT,
    args: readRecord(config, 'args') ?? {},
  };
}

export type { ToolNodeConfig };

export interface ResolvedHttpConfig {
  /** Which saved API connection to send through. `undefined` → `url` must be absolute. */
  providerId?: string;
  method: HttpMethod;
  /** Path or absolute URL. Still an un-interpolated template at this point. */
  url: string;
  /** Extra headers the node adds on top of the connection's. Values still templated. */
  headers: Record<string, string>;
  body?: string;
  timeoutMs: number;
  failOnError: boolean;
}

/**
 * Note the verb is normalised to upper case but *not* whitelisted: the editor
 * offers five, and a workflow written by hand may legitimately use `HEAD`.
 */
export function resolveHttpConfig(node: WorkflowNode): ResolvedHttpConfig {
  const config = node.config;
  const providerId = readString(config, 'providerId')?.trim();
  const method = normalizeMethod(readString(config, 'method'));
  const body = readString(config, 'body');
  const timeoutMs = clampTimeout(readNumber(config, 'timeoutMs'));

  return {
    ...(providerId ? { providerId } : {}),
    method,
    url: readString(config, 'url') ?? '',
    headers: parseHeaderLines(readString(config, 'headers')),
    ...(body ? { body } : {}),
    timeoutMs,
    failOnError: readBoolean(config, 'failOnError') ?? true,
  };
}

export type { HttpNodeConfig };

function normalizeMethod(value: string | undefined): HttpMethod {
  const upper = value?.trim().toUpperCase() ?? '';
  const known = HTTP_METHODS.find((item) => item === upper);
  return (known ?? DEFAULT_HTTP_METHOD) as HttpMethod;
}

/** A missing or nonsense timeout becomes the default; an absurd one is capped. */
function clampTimeout(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) return DEFAULT_HTTP_TIMEOUT_MS;
  return Math.min(Math.round(value), MAX_HTTP_TIMEOUT_MS);
}

export interface ResolvedEndConfig {
  output?: string;
}

export function resolveEndConfig(node: WorkflowNode): ResolvedEndConfig {
  const output = readString(node.config, 'output');
  return output ? { output } : {};
}

export type { EndNodeConfig };
