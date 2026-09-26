import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { SCHEMA_SQL } from './schema.js';

export type Db = Database.Database;

/**
 * Opens (and creates if needed) the SQLite database.
 *
 * WAL keeps reads and writes from blocking each other; the schema is applied
 * idempotently on every boot, so there is no migration step to remember.
 */
export function createDatabase(file: string): Db {
  mkdirSync(dirname(file), { recursive: true });
  const db = openDatabase(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_SQL);
  return db;
}

/**
 * `better-sqlite3` is a native addon, so the binary fetched at install time is
 * bound to one Node ABI. Switching Node major versions (22 -> 24) leaves that
 * binary unloadable, and the raw `dlopen` error only mentions ABI numbers. Wrap
 * it so the failure says what to actually do.
 */
function openDatabase(file: string): Db {
  try {
    return new Database(file);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    const message = error instanceof Error ? error.message : String(error);
    const isNativeLoadFailure = code === 'ERR_DLOPEN_FAILED' || message.includes('better_sqlite3.node');
    if (!isNativeLoadFailure) throw error;

    throw new Error(
      [
        'better-sqlite3 could not load its native binary.',
        `Running Node ${process.version} (module ABI ${process.versions.modules}); the binary on disk was built for a different version.`,
        'Rebuild it with the same Node you start the server with:',
        '',
        '  pnpm rebuild better-sqlite3',
      ].join('\n'),
      { cause: error },
    );
  }
}

/** Parses a JSON column, returning `fallback` when it is empty or invalid. */
export function parseJsonColumn(value: unknown, fallback: unknown = null): unknown {
  if (typeof value !== 'string' || value.length === 0) return fallback;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return fallback;
  }
}

/** Serialises a value for storage; `undefined` becomes SQL NULL. */
export function serializeJson(value: unknown): string | null {
  if (value === undefined) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify(String(value));
  }
}
