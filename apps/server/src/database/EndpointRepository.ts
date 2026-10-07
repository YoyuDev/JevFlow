import type { ProviderProfilePayload } from '../types.js';
import { seal, unseal } from '../utils/crypto.js';
import type { Db } from './index.js';

interface EndpointRow {
  workflow_id: string;
  token: string;
  enabled: number;
  providers_json: string | null;
  published_at: string | null;
  call_count: number;
  error_count: number;
  last_called_at: string | null;
  created_at: string;
  updated_at: string;
}

/** A published endpoint, with its stored connections already decrypted. */
export interface EndpointRecord {
  workflowId: string;
  token: string;
  enabled: boolean;
  /** The connections snapshotted at publish time. Empty → the server's `.env` default. */
  providers: ProviderProfilePayload[];
  /** `true` when the column held credentials we can no longer decode. */
  credentialsUnreadable: boolean;
  publishedAt: string | null;
  callCount: number;
  errorCount: number;
  lastCalledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublishEndpointInput {
  workflowId: string;
  token: string;
  providers: ProviderProfilePayload[];
}

/**
 * All SQL for the `workflow_endpoints` table.
 *
 * The rows are keyed by workflow: one workflow, one public endpoint. Publishing
 * again updates the row in place rather than adding a second one, so a URL that
 * someone already wired into their code keeps working across republishes.
 *
 * `providers_json` is sealed at rest ({@link import('../utils/crypto.js')}) and
 * decrypted here, which is the only reason this repository does more than map
 * columns — the rest of the server sees plain records and never a cipher.
 */
export class EndpointRepository {
  private readonly db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  findByWorkflow(workflowId: string): EndpointRecord | undefined {
    const row = this.db
      .prepare('SELECT * FROM workflow_endpoints WHERE workflow_id = ?')
      .get(workflowId) as EndpointRow | undefined;
    return row ? toRecord(row) : undefined;
  }

  findByToken(token: string): EndpointRecord | undefined {
    const row = this.db
      .prepare('SELECT * FROM workflow_endpoints WHERE token = ?')
      .get(token) as EndpointRow | undefined;
    return row ? toRecord(row) : undefined;
  }

  /** Every published endpoint, newest first. */
  listAll(): EndpointRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM workflow_endpoints ORDER BY updated_at DESC')
      .all() as EndpointRow[];
    return rows.map((row) => toRecord(row));
  }

  /** Creates the endpoint or refreshes an existing one. Returns the stored row. */
  publish(input: PublishEndpointInput): EndpointRecord {
    const now = new Date().toISOString();
    const providers = seal(JSON.stringify(input.providers));

    this.db
      .prepare(
        `INSERT INTO workflow_endpoints
           (workflow_id, token, enabled, providers_json, published_at,
            call_count, error_count, last_called_at, created_at, updated_at)
         VALUES
           (@workflowId, @token, 1, @providers, @now, 0, 0, NULL, @now, @now)
         ON CONFLICT(workflow_id) DO UPDATE SET
           token          = excluded.token,
           enabled        = 1,
           providers_json = excluded.providers_json,
           published_at   = excluded.published_at,
           updated_at     = excluded.updated_at`,
      )
      .run({
        workflowId: input.workflowId,
        token: input.token,
        providers,
        now,
      });

    const stored = this.findByWorkflow(input.workflowId);
    if (!stored) {
      throw new Error(`Endpoint for workflow "${input.workflowId}" vanished right after publishing`);
    }
    return stored;
  }

  setEnabled(workflowId: string, enabled: boolean): EndpointRecord | undefined {
    const result = this.db
      .prepare('UPDATE workflow_endpoints SET enabled = ?, updated_at = ? WHERE workflow_id = ?')
      .run(enabled ? 1 : 0, new Date().toISOString(), workflowId);
    return result.changes > 0 ? this.findByWorkflow(workflowId) : undefined;
  }

  remove(workflowId: string): boolean {
    return this.db.prepare('DELETE FROM workflow_endpoints WHERE workflow_id = ?').run(workflowId).changes > 0;
  }

  /** Called once per public invocation — this is what the panel's counters show. */
  recordCall(workflowId: string, ok: boolean): void {
    this.db
      .prepare(
        `UPDATE workflow_endpoints
            SET call_count     = call_count + 1,
                error_count    = error_count + @failed,
                last_called_at = @now,
                updated_at     = @now
          WHERE workflow_id = @workflowId`,
      )
      .run({ failed: ok ? 0 : 1, now: new Date().toISOString(), workflowId });
  }
}

function toRecord(row: EndpointRow): EndpointRecord {
  const plain = unseal(row.providers_json);
  // Two different failures wear the same face: no credentials stored at all, and
  // credentials we can no longer open. Only the second one deserves a warning.
  const credentialsUnreadable = row.providers_json !== null && plain === null;

  return {
    workflowId: row.workflow_id,
    token: row.token,
    enabled: row.enabled === 1,
    providers: plain === null ? [] : parseProfiles(plain),
    credentialsUnreadable,
    publishedAt: row.published_at,
    callCount: row.call_count,
    errorCount: row.error_count,
    lastCalledAt: row.last_called_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseProfiles(plain: string): ProviderProfilePayload[] {
  try {
    const parsed: unknown = JSON.parse(plain);
    return Array.isArray(parsed) ? (parsed as ProviderProfilePayload[]) : [];
  } catch {
    return [];
  }
}
