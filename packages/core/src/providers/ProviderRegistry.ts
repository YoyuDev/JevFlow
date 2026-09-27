import { createJevClient, createLLMClient } from '../config/factory.js';
import type {
  JevClient,
  JevProviderHandle,
  LLMClient,
  LLMProviderHandle,
  NodeProviderResolver,
} from '../types/index.js';

/**
 * One saved connection, as handed over by the host.
 *
 * The Studio keeps these in the browser and sends the ones a workflow actually
 * references along with every run; nothing here is ever persisted server-side.
 */
export interface ProviderProfileLike {
  id: string;
  kind: 'llm' | 'jev';
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  /** Human label. Falls back to the id, so the trace is never anonymous. */
  label?: string;
}

/**
 * Named providers, addressable by id from a node's `config.providerId`.
 *
 * This is what turns "one engine, one LLM" into "one engine, a different LLM per
 * node": the engine still owns a default client, and a node may point somewhere
 * else. The same `no key means mock` rule applies per profile, so a half-filled
 * connection degrades to the mock instead of breaking the run.
 */
export class ProviderRegistry implements NodeProviderResolver {
  private readonly llmHandles = new Map<string, LLMProviderHandle>();
  private readonly jevHandles = new Map<string, JevProviderHandle>();

  private constructor() {
    /* use `ProviderRegistry.from()` */
  }

  static from(profiles: readonly ProviderProfileLike[] = []): ProviderRegistry {
    const registry = new ProviderRegistry();
    for (const profile of profiles) {
      const id = profile.id?.trim();
      if (!id) continue;
      const label = profile.label?.trim() || id;
      const config = {
        ...(profile.apiKey?.trim() ? { apiKey: profile.apiKey.trim() } : {}),
        ...(profile.baseUrl?.trim() ? { baseUrl: profile.baseUrl.trim() } : {}),
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

  /** Registered ids — handy for logs and for asserting a node's reference. */
  get ids(): string[] {
    return [...this.llmHandles.keys(), ...this.jevHandles.keys()];
  }

  get size(): number {
    return this.llmHandles.size + this.jevHandles.size;
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
