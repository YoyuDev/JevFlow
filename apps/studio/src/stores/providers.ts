import { computed, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import type {
  ProviderCredentials,
  ProviderKind,
  ProviderProfile,
  ProviderProfilePayload,
  RunProviders,
} from '@/types';

const STORAGE_KEY = 'jevflow.providers';

interface StoredProviders {
  profiles: ProviderProfile[];
}

function emptyState(): StoredProviders {
  return { profiles: [] };
}

/**
 * A library of LLM / Jev connections, held in `localStorage`.
 *
 * This store is deliberately *not* a “current provider” switch: a workflow
 * usually wants node A on one vendor and node B on another, so the choice lives
 * on the node (`config.providerId`) and this store only owns the library.
 *
 * Credentials stay in the browser rather than SQLite: the database is a plain
 * file people copy around, and an API key has no business being in it. They
 * travel to the server one run at a time, inside the `/run` body, and only for
 * the connections the workflow actually references.
 */
export const useProvidersStore = defineStore('providers', () => {
  const profiles = ref<ProviderProfile[]>(readStored().profiles);

  /* -------------------------------- getters ------------------------------- */
  const llmProfiles = computed(() => profiles.value.filter((item) => item.kind === 'llm'));
  const jevProfiles = computed(() => profiles.value.filter((item) => item.kind === 'jev'));

  function profilesOf(kind: ProviderKind): ProviderProfile[] {
    return kind === 'llm' ? llmProfiles.value : jevProfiles.value;
  }

  function byId(id: string): ProviderProfile | undefined {
    return profiles.value.find((item) => item.id === id);
  }

  /** Label for a node's picker button / canvas summary. `undefined` if unknown. */
  function nameOf(id: string): string | undefined {
    return id ? byId(id)?.name : undefined;
  }

  /** A connection with no key silently runs as the mock — the UI says so. */
  function isIncomplete(id: string): boolean {
    const profile = byId(id);
    return profile !== undefined && profile.apiKey.trim().length === 0;
  }

  /* -------------------------------- actions ------------------------------- */
  /** Adds a blank connection and returns it, so the panel can focus its name. */
  function addProfile(kind: ProviderKind): ProviderProfile {
    const profile: ProviderProfile = {
      id: createProfileId(kind),
      kind,
      name: `${kind === 'llm' ? 'LLM' : 'Jev'} ${profilesOf(kind).length + 1}`,
      apiKey: '',
      baseUrl: '',
      model: '',
    };
    profiles.value = [...profiles.value, profile];
    return profile;
  }

  function updateProfile(id: string, patch: Partial<ProviderCredentials> & { name?: string }): void {
    const index = profiles.value.findIndex((item) => item.id === id);
    if (index < 0) return;
    const next = [...profiles.value];
    next[index] = { ...next[index], ...patch } as ProviderProfile;
    profiles.value = next;
  }

  function removeProfile(id: string): void {
    profiles.value = profiles.value.filter((item) => item.id !== id);
  }

  function removeAll(): void {
    profiles.value = [];
  }

  /* --------------------------------- run ---------------------------------- */

  /**
   * The `providers` field for a `/run` request.
   *
   * Node configs carry only a profile id, so this is where the credentials get
   * resolved — and only for the ids the workflow actually uses. A node pointing
   * at a deleted connection resolves to nothing and falls back server-side.
   */
  function selectionFor(configs: readonly (Record<string, unknown> | undefined)[]): RunProviders {
    const wanted = new Set<string>();
    for (const config of configs) {
      const id = config?.['providerId'];
      if (typeof id === 'string' && id.length > 0) wanted.add(id);
    }

    const payload: ProviderProfilePayload[] = profiles.value
      .filter((profile) => wanted.has(profile.id))
      .map((profile) => ({
        id: profile.id,
        kind: profile.kind,
        label: profile.name,
        apiKey: profile.apiKey,
        baseUrl: profile.baseUrl,
        model: profile.model,
      }));

    return { profiles: payload };
  }

  /** Ids referenced by the given node configs — used for the “in use” badges. */
  function usageCount(id: string, configs: readonly (Record<string, unknown> | undefined)[]): number {
    return configs.filter((config) => config?.['providerId'] === id).length;
  }

  /* ------------------------------ persistence ----------------------------- */
  watch(profiles, (value) => writeStored({ profiles: value }), { deep: true });

  return {
    // state
    profiles,
    // getters
    llmProfiles,
    jevProfiles,
    // actions
    profilesOf,
    byId,
    nameOf,
    isIncomplete,
    addProfile,
    updateProfile,
    removeProfile,
    removeAll,
    selectionFor,
    usageCount,
  };
});

/* --------------------------------- storage -------------------------------- */

function readStored(): StoredProviders {
  const fallback = emptyState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return fallback;

    const rawProfiles = parsed['profiles'];
    return {
      profiles: Array.isArray(rawProfiles)
        ? rawProfiles.map(toProfile).filter((item): item is ProviderProfile => item !== null)
        : [],
    };
  } catch {
    // Corrupt or unreadable storage must never stop the Studio from loading.
    return fallback;
  }
}

function writeStored(state: StoredProviders): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* the connections simply will not survive a reload */
  }
}

function toProfile(value: unknown): ProviderProfile | null {
  if (!isRecord(value)) return null;
  const kind = value['kind'];
  if (kind !== 'llm' && kind !== 'jev') return null;
  const id = readString(value['id']);
  if (!id) return null;
  return {
    id,
    kind,
    name: readString(value['name']) ?? id,
    apiKey: readString(value['apiKey']) ?? '',
    baseUrl: readString(value['baseUrl']) ?? '',
    model: readString(value['model']) ?? '',
  };
}

function createProfileId(kind: ProviderKind): string {
  return `${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
