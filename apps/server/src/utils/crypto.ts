import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { REPO_ROOT } from '../config/env.js';

/**
 * Credential sealing for published endpoints.
 *
 * Everywhere else in JevFlow an API key lives in the browser and only crosses
 * the wire for the duration of one run. A *published* workflow is the single
 * exception: the caller holds nothing but a token, so the server has to keep the
 * connections itself. That is the one place a key outlives a request, and the
 * one place worth encrypting.
 *
 * AES-256-GCM, key derived from `JEVFLOW_SECRET`, falling back to a generated
 * `data/.secret`. Sealed values are self-describing (`v1.iv.tag.data`), so a
 * future format change can be detected instead of silently misread.
 */

const PREFIX = 'v1';
const SECRET_FILE = join(REPO_ROOT, 'data', '.secret');

let cachedSecret: string | null = null;

/**
 * The process-wide sealing key.
 *
 * `JEVFLOW_SECRET` wins when set — that is what makes a published endpoint
 * survive being copied to another machine, since the generated file does not
 * travel with the database. Without it we generate one next to the database.
 */
function secret(): string {
  if (cachedSecret !== null) return cachedSecret;
  const fromEnv = (process.env['JEVFLOW_SECRET'] ?? '').trim();
  cachedSecret = fromEnv.length > 0 ? fromEnv : readOrCreateSecretFile();
  return cachedSecret;
}

function readOrCreateSecretFile(): string {
  try {
    if (existsSync(SECRET_FILE)) {
      const existing = readFileSync(SECRET_FILE, 'utf8').trim();
      if (existing.length > 0) return existing;
    }
    const generated = randomBytes(32).toString('hex');
    mkdirSync(dirname(SECRET_FILE), { recursive: true });
    // `mode` is advisory on Windows, meaningful everywhere else.
    writeFileSync(SECRET_FILE, `${generated}\n`, { mode: 0o600 });
    return generated;
  } catch {
    // A read-only checkout must still boot. Sealing then lives for one process
    // only: stored credentials become unreadable after a restart, and the
    // endpoint degrades to the server default instead of crashing the server.
    return randomBytes(32).toString('hex');
  }
}

function key(): Buffer {
  return createHash('sha256').update(secret()).digest();
}

/** Encrypts a string for storage. Never throws — callers get `null` on failure. */
export function seal(plain: string): string | null {
  try {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key(), iv);
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return [PREFIX, iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(
      '.',
    );
  } catch {
    return null;
  }
}

/**
 * Decrypts what `seal` produced. `null` means “unreadable” — a rotated
 * `JEVFLOW_SECRET`, a truncated column, or a value written by a future format.
 * Callers treat that as “no stored credentials”, not as a hard error.
 */
export function unseal(payload: string | null | undefined): string | null {
  if (typeof payload !== 'string' || payload.length === 0) return null;
  const parts = payload.split('.');
  if (parts.length !== 4 || parts[0] !== PREFIX) return null;

  try {
    const iv = Buffer.from(parts[1] ?? '', 'base64');
    const tag = Buffer.from(parts[2] ?? '', 'base64');
    const data = Buffer.from(parts[3] ?? '', 'base64');
    const decipher = createDecipheriv('aes-256-gcm', key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/** A URL-safe endpoint token: `jf_` plus 32 characters of entropy. */
export function createEndpointToken(): string {
  return `jf_${randomBytes(24).toString('base64url')}`;
}
