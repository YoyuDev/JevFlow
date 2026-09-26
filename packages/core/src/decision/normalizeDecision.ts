import type { DecisionResult } from '../types/index.js';
import { isRecord, readNumber, readString } from '../utils/value.js';
import { WorkflowError } from '../types/index.js';

/**
 * Normalises whatever a real Jev endpoint returned into a `DecisionResult`.
 *
 * Accepted shapes:
 *   { "choice": "complete", "probability": 0.93, "confidence": 0.95 }
 *   { "decision": { ... } } / { "data": { ... } } / { "result": { ... } }
 *   "complete"                     (bare string)
 *
 * Anything else fails loudly — a silent wrong branch is worse than an error.
 */
export function normalizeDecisionPayload(payload: unknown, choices: string[]): DecisionResult {
  if (typeof payload === 'string') {
    return { choice: matchChoice(payload, choices) };
  }

  const record = unwrap(payload);
  const rawChoice =
    readString(record, 'choice') ??
    readString(record, 'decision') ??
    readString(record, 'label') ??
    readString(record, 'answer');

  if (!rawChoice) {
    throw new WorkflowError('INVALID_DECISION', 'Decision payload has no choice-like field', {
      payload: safeStringify(payload),
    });
  }

  return {
    choice: matchChoice(rawChoice, choices),
    probability: readNumber(record, 'probability') ?? readNumber(record, 'score'),
    confidence: readNumber(record, 'confidence'),
    reason: readString(record, 'reason'),
  };
}

function unwrap(payload: unknown): Record<string, unknown> {
  if (!isRecord(payload)) {
    throw new WorkflowError('INVALID_DECISION', 'Decision payload is not an object', {
      payload: safeStringify(payload),
    });
  }
  for (const key of ['decision', 'data', 'result', 'output']) {
    const nested = payload[key];
    if (isRecord(nested)) return nested;
  }
  return payload;
}

function matchChoice(raw: string, choices: string[]): string {
  const trimmed = raw.trim();
  const exact = choices.find((choice) => choice === trimmed);
  if (exact) return exact;
  const lower = trimmed.toLowerCase();
  const caseless = choices.find((choice) => choice.toLowerCase() === lower);
  if (caseless) return caseless;
  throw new WorkflowError(
    'INVALID_DECISION',
    `Decision "${raw}" is not one of the allowed choices: ${choices.join(', ')}`,
    { raw, choices },
  );
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value)?.slice(0, 500) ?? String(value);
  } catch {
    return String(value);
  }
}
