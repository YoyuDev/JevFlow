import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import type { LogLevel } from '@jevflow/core';

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));

/** `apps/server` — works from both `src/` and `dist/`. */
export const APP_ROOT = resolve(CURRENT_DIR, '../..');
/** Monorepo root. */
export const REPO_ROOT = resolve(CURRENT_DIR, '../../../..');

// Root `.env` first, then a server-local one can override it.
loadDotenv({ path: [join(REPO_ROOT, '.env'), join(APP_ROOT, '.env')] });

export interface ServerEnv {
  port: number;
  host: string;
  /** Absolute path of the SQLite file. */
  databaseFile: string;
  logLevel: LogLevel;
  /** `true` when no credentials at all are present (or forced by env). */
  offline: boolean;
  llm: { apiKey: string; baseUrl: string; model: string };
  jev: { apiKey: string; baseUrl: string; model: string };
}

function readString(name: string): string {
  return (process.env[name] ?? '').trim();
}

function readNumber(name: string, fallback: number): number {
  const raw = readString(name);
  if (raw.length === 0) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveDatabaseFile(raw: string): string {
  if (raw.length === 0) return join(REPO_ROOT, 'data', 'jevflow.db');
  return isAbsolute(raw) ? raw : join(REPO_ROOT, raw);
}

export function loadEnv(): ServerEnv {
  const llm = {
    apiKey: readString('LLM_API_KEY'),
    baseUrl: readString('LLM_BASE_URL'),
    model: readString('LLM_MODEL'),
  };
  const jev = {
    apiKey: readString('JEV_API_KEY'),
    baseUrl: readString('JEV_BASE_URL'),
    model: readString('JEV_MODEL'),
  };
  const forceMock = readString('JEVFLOW_FORCE_MOCK').toLowerCase() === 'true';

  return {
    port: readNumber('PORT', 3000),
    host: readString('HOST') || '127.0.0.1',
    databaseFile: resolveDatabaseFile(readString('DATABASE_FILE')),
    logLevel: (readString('LOG_LEVEL') || 'info') as LogLevel,
    offline: forceMock || (!llm.apiKey && !jev.apiKey),
    llm,
    jev,
  };
}

export const env: ServerEnv = loadEnv();
