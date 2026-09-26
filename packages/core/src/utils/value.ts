/** Small, `any`-free readers for values that come from JSON / user input. */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readString(source: Record<string, unknown> | undefined, key: string): string | undefined {
  if (!source) return undefined;
  const value = source[key];
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
}

export function readNumber(source: Record<string, unknown> | undefined, key: string): number | undefined {
  if (!source) return undefined;
  const value = source[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export function readBoolean(source: Record<string, unknown> | undefined, key: string): boolean | undefined {
  if (!source) return undefined;
  const value = source[key];
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

export function readStringArray(
  source: Record<string, unknown> | undefined,
  key: string,
): string[] | undefined {
  if (!source) return undefined;
  const value = source[key];
  if (!Array.isArray(value)) return undefined;
  const strings = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0);
  return strings.length > 0 ? strings : undefined;
}

export function readRecord(
  source: Record<string, unknown> | undefined,
  key: string,
): Record<string, unknown> | undefined {
  if (!source) return undefined;
  const value = source[key];
  return isRecord(value) ? value : undefined;
}

/** Truncate for trace previews. */
export function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

/** Human-readable preview of an arbitrary value. */
export function formatValue(value: unknown, maxLength = 400): string {
  if (value === undefined) return '';
  if (value === null) return 'null';
  if (typeof value === 'string') return truncate(value, maxLength);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Error) return value.message;
  try {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? String(value) : truncate(serialized, maxLength);
  } catch {
    return '[unserializable]';
  }
}

/** Best-effort deep clone that never throws (structuredClone is not ubiquitous). */
export function cloneValue<T>(value: T): T {
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return value;
  }
}
