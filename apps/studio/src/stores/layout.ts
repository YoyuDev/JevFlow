import { computed, ref } from 'vue';
import type { CSSProperties } from 'vue';
import { defineStore } from 'pinia';

export const LAYOUT_STORAGE_KEY = 'jevflow.layout';

/**
 * Every pane is a plain pixel number — no CSS grid `minmax()` magic, because the
 * drag handler has to reason about the value anyway.
 *
 * `fallback` is what a first-time visitor gets, and what a double-click on the
 * handle restores.
 */
export const PANE_BOUNDS = {
  /** Node library, left column. */
  left: { min: 180, max: 460, fallback: 236 },
  /** Node inspector, right column. */
  right: { min: 280, max: 560, fallback: 340 },
  /** Execution trace, bottom row. */
  bottom: { min: 120, max: 560, fallback: 244 },
} as const;

export type PaneKey = keyof typeof PANE_BOUNDS;

type PaneSizes = Record<PaneKey, number>;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function resolveSize(key: PaneKey, value: unknown): number {
  const bounds = PANE_BOUNDS[key];
  return clamp(typeof value === 'number' ? value : bounds.fallback, bounds.min, bounds.max);
}

/**
 * A stored layout can be stale — another window, a hand-edited value, a broken
 * entry — so anything unreadable just falls back to the defaults.
 */
function readStored(): Record<string, unknown> {
  try {
    const raw = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export const useLayoutStore = defineStore('layout', () => {
  const stored = readStored();

  const sizes = ref<PaneSizes>({
    left: resolveSize('left', stored['left']),
    right: resolveSize('right', stored['right']),
    bottom: resolveSize('bottom', stored['bottom']),
  });

  const left = computed(() => sizes.value.left);
  const right = computed(() => sizes.value.right);
  const bottom = computed(() => sizes.value.bottom);

  /**
   * Inline CSS custom properties consumed by `.app-shell` and its children.
   * Cast because `CSSProperties` has no index signature for custom properties.
   */
  const vars = computed<CSSProperties>(
    () =>
      ({
        '--pane-left': `${sizes.value.left}px`,
        '--pane-right': `${sizes.value.right}px`,
        '--pane-bottom': `${sizes.value.bottom}px`,
      }) as CSSProperties,
  );

  function persist(): void {
    try {
      window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(sizes.value));
    } catch {
      /* the layout simply will not survive the reload */
    }
  }

  /** Out-of-range values are clamped, so a caller can pass anything it likes. */
  function setPane(key: PaneKey, value: number): void {
    const next = resolveSize(key, value);
    if (sizes.value[key] === next) return;
    sizes.value = { ...sizes.value, [key]: next };
    persist();
  }

  function resetPane(key: PaneKey): void {
    setPane(key, PANE_BOUNDS[key].fallback);
  }

  function reset(): void {
    sizes.value = {
      left: PANE_BOUNDS.left.fallback,
      right: PANE_BOUNDS.right.fallback,
      bottom: PANE_BOUNDS.bottom.fallback,
    };
    persist();
  }

  return { left, right, bottom, vars, setPane, resetPane, reset };
});
