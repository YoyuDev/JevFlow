import type { LLMClient, LLMRequest, LLMResponse, LLMUsage } from '../types/index.js';
import { WorkflowError, toErrorMessage } from '../types/index.js';
import { type FetchLike, getDefaultFetch, safeReadText } from '../utils/fetch.js';
import { isRecord, readNumber, readString } from '../utils/value.js';

export interface RealLLMClientOptions {
  apiKey: string;
  /** OpenAI-compatible base url, e.g. `https://api.deepseek.com/v1`. */
  baseUrl?: string;
  /** Default model when a node does not pick one. */
  model?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * Talks to any OpenAI-compatible `/chat/completions` endpoint.
 * No SDK dependency — one fetch, no surprises.
 */
export class RealLLMClient implements LLMClient {
  readonly name = 'openai-compatible';

  private readonly options: RealLLMClientOptions;

  constructor(options: RealLLMClientOptions) {
    if (!options.apiKey) {
      throw new WorkflowError('INVALID_CONFIG', 'RealLLMClient requires an apiKey');
    }
    this.options = options;
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const baseUrl = (this.options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    const model =
      request.model && request.model !== 'mock-model' ? request.model : (this.options.model ?? DEFAULT_MODEL);
    const fetchImpl = this.options.fetchImpl ?? getDefaultFetch();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    const messages: Array<{ role: string; content: string }> = [];
    if (request.systemPrompt) messages.push({ role: 'system', content: request.systemPrompt });
    messages.push({ role: 'user', content: request.prompt });

    try {
      const response = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.options.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: request.temperature ?? 0.7,
          ...(request.maxTokens ? { max_tokens: request.maxTokens } : {}),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new WorkflowError('LLM_FAILED', `LLM request failed with status ${response.status}`, {
          status: response.status,
          body: (await safeReadText(response)).slice(0, 500),
        });
      }

      const payload: unknown = await response.json();
      return parseChatCompletion(payload, model);
    } catch (error) {
      if (error instanceof WorkflowError) throw error;
      throw new WorkflowError('LLM_FAILED', `LLM request failed: ${toErrorMessage(error)}`);
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Extracts `choices[0].message.content` from an OpenAI-shaped payload. */
function parseChatCompletion(payload: unknown, fallbackModel: string): LLMResponse {
  if (!isRecord(payload)) {
    throw new WorkflowError('LLM_FAILED', 'LLM response is not a JSON object');
  }
  const choices = payload['choices'];
  const first = Array.isArray(choices) ? choices[0] : undefined;
  const message = isRecord(first) ? first['message'] : undefined;
  const content = isRecord(message) ? readString(message, 'content') : undefined;

  if (!content) {
    throw new WorkflowError('LLM_FAILED', 'LLM response did not contain any content', {
      payload: JSON.stringify(payload).slice(0, 500),
    });
  }

  return {
    content,
    model: readString(payload, 'model') ?? fallbackModel,
    usage: parseUsage(payload['usage']),
  };
}

function parseUsage(usage: unknown): LLMUsage | undefined {
  if (!isRecord(usage)) return undefined;
  const promptTokens = readNumber(usage, 'prompt_tokens') ?? 0;
  const completionTokens = readNumber(usage, 'completion_tokens') ?? 0;
  return {
    promptTokens,
    completionTokens,
    totalTokens: readNumber(usage, 'total_tokens') ?? promptTokens + completionTokens,
  };
}
