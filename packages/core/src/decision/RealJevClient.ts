import type { DecisionResult, JevClient } from '../types/index.js';
import { WorkflowError, toErrorMessage } from '../types/index.js';
import { type FetchLike, getDefaultFetch, safeReadText } from '../utils/fetch.js';
import { normalizeDecisionPayload } from './normalizeDecision.js';

export interface RealJevClientOptions {
  apiKey: string;
  baseUrl: string;
  /** Optional model / policy id sent along with the request. */
  model?: string;
  /** Path appended to baseUrl. Defaults to `/decide`. */
  path?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * HTTP Jev client.
 *
 * Request:  POST {baseUrl}{path}  { question, choices, context, model? }
 * Response: anything `normalizeDecisionPayload` understands.
 *
 * If your Jev deployment uses a different envelope, adjust `normalizeDecision`
 * — the Workflow Engine never needs to change.
 */
export class RealJevClient implements JevClient {
  readonly name = 'real-jev';

  private readonly options: RealJevClientOptions;

  constructor(options: RealJevClientOptions) {
    if (!options.apiKey) {
      throw new WorkflowError('INVALID_CONFIG', 'RealJevClient requires an apiKey');
    }
    if (!options.baseUrl) {
      throw new WorkflowError('INVALID_CONFIG', 'RealJevClient requires a baseUrl');
    }
    this.options = options;
  }

  async decide(question: string, choices: string[], context: unknown): Promise<DecisionResult> {
    const baseUrl = this.options.baseUrl.replace(/\/+$/, '');
    const path = this.options.path ?? '/decide';
    const fetchImpl = this.options.fetchImpl ?? getDefaultFetch();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetchImpl(`${baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.options.apiKey}`,
        },
        body: JSON.stringify({
          question,
          choices,
          context,
          ...(this.options.model ? { model: this.options.model } : {}),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new WorkflowError('JEV_FAILED', `Jev request failed with status ${response.status}`, {
          status: response.status,
          body: (await safeReadText(response)).slice(0, 500),
        });
      }

      const payload: unknown = await response.json();
      return normalizeDecisionPayload(payload, choices);
    } catch (error) {
      if (error instanceof WorkflowError) throw error;
      throw new WorkflowError('JEV_FAILED', `Jev request failed: ${toErrorMessage(error)}`);
    } finally {
      clearTimeout(timer);
    }
  }
}
