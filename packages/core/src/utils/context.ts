import { isRecord, readString } from './value.js';

const EVIDENCE_KEYS = ['results', 'documents', 'sources', 'evidence', 'items', 'hits'];
const INPUT_KEYS = ['input', 'rawInput', 'userInput', 'query', 'text', 'prompt', 'message'];
const MAX_DEPTH = 5;

function toStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap((item) => toStrings(item));
  if (isRecord(value)) {
    const preferred = readString(value, 'content') ?? readString(value, 'text');
    return preferred ? [preferred] : [];
  }
  return [];
}

/** Walks the context and collects everything that looks like retrieved evidence. */
export function collectEvidence(context: unknown, depth = 0): string[] {
  if (depth > MAX_DEPTH || context === null || context === undefined) return [];
  if (Array.isArray(context)) return context.flatMap((item) => collectEvidence(item, depth + 1));
  if (!isRecord(context)) return [];

  const found: string[] = [];
  for (const [key, value] of Object.entries(context)) {
    if (EVIDENCE_KEYS.includes(key)) {
      found.push(...toStrings(value));
      continue;
    }
    if (typeof value === 'object' && value !== null) {
      found.push(...collectEvidence(value, depth + 1));
    }
  }
  return found.filter((item) => item.trim().length > 0);
}

/** Walks the context and collects the user's actual input, if any. */
export function collectUserInput(context: unknown, depth = 0): string[] {
  if (depth > MAX_DEPTH || context === null || context === undefined) return [];
  if (typeof context === 'string') return [context];
  if (Array.isArray(context)) return context.flatMap((item) => collectUserInput(item, depth + 1));
  if (!isRecord(context)) return [];

  const found: string[] = [];
  for (const [key, value] of Object.entries(context)) {
    if (INPUT_KEYS.includes(key)) {
      found.push(...toStrings(value));
      continue;
    }
    if (typeof value === 'object' && value !== null) {
      found.push(...collectUserInput(value, depth + 1));
    }
  }
  return found.filter((item) => item.trim().length > 0);
}

/** Deterministic 32-bit string hash (djb2). No crypto, no randomness. */
export function hashString(value: string): number {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) + hash + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** Rounds to 2 decimals so mock numbers look like real probabilities. */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
