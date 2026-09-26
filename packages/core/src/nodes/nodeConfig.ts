import {
  DEFAULT_JEV_CHOICES,
  DEFAULT_JEV_QUESTION,
  DEFAULT_LLM_MODEL,
  DEFAULT_LLM_PROMPT,
  DEFAULT_LLM_TEMPERATURE,
  DEFAULT_SEARCH_TOOL,
} from '../constants.js';
import type {
  EndNodeConfig,
  JevNodeConfig,
  LLMNodeConfig,
  ToolNodeConfig,
  WorkflowNode,
} from '../types/index.js';
import { readNumber, readRecord, readString, readStringArray } from '../utils/value.js';

/**
 * Config readers.
 *
 * Workflow JSON is untrusted input, so every executor resolves its config
 * through these functions: defaults are always present, types are always right,
 * and nothing downstream has to deal with `unknown`.
 */

export interface ResolvedLLMConfig {
  model: string;
  prompt: string;
  systemPrompt?: string;
  temperature: number;
  maxTokens?: number;
}

export function resolveLLMConfig(node: WorkflowNode): ResolvedLLMConfig {
  const config = node.config;
  const resolved: ResolvedLLMConfig = {
    model: readString(config, 'model') ?? DEFAULT_LLM_MODEL,
    prompt: readString(config, 'prompt') ?? DEFAULT_LLM_PROMPT,
    temperature: readNumber(config, 'temperature') ?? DEFAULT_LLM_TEMPERATURE,
  };
  const systemPrompt = readString(config, 'systemPrompt');
  if (systemPrompt) resolved.systemPrompt = systemPrompt;
  const maxTokens = readNumber(config, 'maxTokens');
  if (maxTokens) resolved.maxTokens = maxTokens;
  return resolved;
}

/** The typed config shape, for callers that want to build nodes in code. */
export type { LLMNodeConfig };

export interface ResolvedJevConfig {
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

export interface ResolvedEndConfig {
  output?: string;
}

export function resolveEndConfig(node: WorkflowNode): ResolvedEndConfig {
  const output = readString(node.config, 'output');
  return output ? { output } : {};
}

export type { EndNodeConfig };
