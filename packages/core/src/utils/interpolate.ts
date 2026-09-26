import { isRecord } from './value.js';

const TOKEN_PATTERN = /\{\{\s*([\w.$-]+)\s*\}\}/g;

/** `a.b.c` lookup inside a plain object scope. Never throws. */
export function resolvePath(scope: Record<string, unknown>, path: string): unknown {
  const segments = path.split('.');
  let current: unknown = scope;
  for (const segment of segments) {
    if (!isRecord(current)) return undefined;
    current = current[segment];
  }
  return current;
}

/**
 * Renders a value into a prompt-friendly string.
 *
 * Objects are not dumped as JSON when we can do better: LLM outputs expose
 * `content`, tool outputs expose `results`. That keeps templates readable —
 * `{{tool-1}}` gives you the search hits, not a JSON blob.
 */
export function stringifyValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value.map((item) => stringifyValue(item)).join('\n');
  }
  if (isRecord(value)) {
    if (typeof value.content === 'string') return value.content;
    if (Array.isArray(value.results)) {
      return value.results.map((item) => stringifyValue(item)).join('\n');
    }
    if (typeof value.text === 'string') return value.text;
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

/**
 * Replaces `{{token}}` placeholders with values from `scope`.
 * Unknown tokens resolve to an empty string (never to `undefined`).
 */
export function interpolate(template: string, scope: Record<string, unknown>): string {
  if (!template) return '';
  if (!template.includes('{{')) return template;
  return template.replace(TOKEN_PATTERN, (_match, path: string) => stringifyValue(resolvePath(scope, path)));
}

/** Tokens referenced by a template — used for the Studio's hints. */
export function extractTokens(template: string): string[] {
  const tokens = new Set<string>();
  for (const match of template.matchAll(TOKEN_PATTERN)) {
    const token = match[1];
    if (token) tokens.add(token);
  }
  return [...tokens];
}
