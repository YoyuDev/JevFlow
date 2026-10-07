import { createJevClient, createLLMClient } from '../config/factory.js';
import type {
  ApiProviderHandle,
  JevClient,
  JevProviderHandle,
  LLMClient,
  LLMProviderHandle,
  NodeProviderResolver,
} from '../types/index.js';
import { parseHeaderLines } from '../utils/headers.js';

/**
 * One saved connection, as handed over by the host.
 *
 * The Studio keeps these in the browser and sends the ones a workflow actually
 * references along with every run; nothing here is ever persisted server-side.
 *
 * The three kinds are not symmetric on purpose. `llm` and `jev` become ready-made
 * clients; `api` carries no client at all — just a base URL and how to attach the
 * secret — because the HTTP node decides the verb, path and body at run time.
 */
export interface ProviderProfileLike {
  id: string;
  kind: 'llm' | 'jev' | 'api';
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  /** Human label. Falls back to the id, so the trace is never anonymous. */
  label?: string;
  /** API connections only — header the key travels in. Default `Authorization`. */
  authHeader?: string;
  /** API connections only — prefix before the key. `'Bearer '`, `''` for x-api-key style. */
  authScheme?: string;
  /** API connections only — extra headers, one `Name: value` per line. */
  headers?: string;
}

/**
 * Named providers, addressable by id from a node's `config.providerId`.
 *
 * This is what turns "one engine, one LLM" into "one engine, a different vendor
 * per node": the engine still owns a default client, and a node may point
 * somewhere else. The same `no key means mock` rule applies per profile, so a
 * half-filled connection degrades to the mock instead of breaking the run.
 */
export class ProviderRegistry implements NodeProviderResolver {
  private readonly llmHandles = new Map<string, LLMProviderHandle>();
  private readonly jevHandles = new Map<string, JevProviderHandle>();
  private readonly apiHandles = new Map<string, ApiProviderHandle>();

  private constructor() {
    /* use `ProviderRegistry.from()` */
  }

  static from(profiles: readonly ProviderProfileLike[] = []): ProviderRegistry {
    const registry = new ProviderRegistry();
    for (const profile of profiles) {
      const id = profile.id?.trim();
      if (!id) continue;
      const label = profile.label?.trim() || id;
      const apiKey = profile.apiKey?.trim() ?? '';
      const baseUrl = profile.baseUrl?.trim() ?? '';
      const config = {
        ...(apiKey ? { apiKey } : {}),
        ...(baseUrl ? { baseUrl } : {}),
        ...(profile.model?.trim() ? { model: profile.model.trim() } : {}),
      };

      if (profile.kind === 'llm') {
        registry.llmHandles.set(id, {
          client: createLLMClient(config),
          ...(config.model ? { model: config.model } : {}),
          label,
        });
      } else if (profile.kind === 'jev') {
        registry.jevHandles.set(id, { client: createJevClient(config), label });
      } else if (profile.kind === 'api') {
        const headers = parseHeaderLines(profile.headers);
        const authHeader = profile.authHeader?.trim();
        registry.apiHandles.set(id, {
          baseUrl,
          ...(apiKey ? { apiKey } : {}),
          ...(authHeader ? { authHeader } : {}),
          // An explicitly empty scheme is meaningful (`x-api-key: sk-…`), so this
          // one is copied through even when blank.
          ...(profile.authScheme !== undefined ? { authScheme: profile.authScheme } : {}),
          ...(Object.keys(headers).length > 0 ? { headers } : {}),
          label,
        });
      }
    }
    return registry;
  }

  llm(id: string): LLMProviderHandle | undefined {
    return this.llmHandles.get(id);
  }

  jev(id: string): JevProviderHandle | undefined {
    return this.jevHandles.get(id);
  }

  api(id: string): ApiProviderHandle | undefined {
    return this.apiHandles.get(id);
  }

  /** Registered ids — handy for logs and for asserting a node's reference. */
  get ids(): string[] {
    return [...this.llmHandles.keys(), ...this.jevHandles.keys(), ...this.apiHandles.keys()];
  }

  get size(): number {
    return this.llmHandles.size + this.jevHandles.size + this.apiHandles.size;
  }

  /** The LLM clients in registration order (the first one is a sane default). */
  get llmClients(): LLMClient[] {
    return [...this.llmHandles.values()].map((handle) => handle.client);
  }

  /** The Jev clients in registration order. */
  get jevClients(): JevClient[] {
    return [...this.jevHandles.values()].map((handle) => handle.client);
  }
}
