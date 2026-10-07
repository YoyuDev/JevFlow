/**
 * Schema for `data/jevflow.db`.
 *
 * Three tables, deliberately denormalised: a workflow is stored as one JSON
 * document (`definition_json`) instead of being shredded into nodes/edges
 * tables. Phase 1 does not need to query inside a definition.
 */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS workflows (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT,
  version         INTEGER NOT NULL DEFAULT 1,
  definition_json TEXT NOT NULL,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workflows_updated_at ON workflows (updated_at DESC);

CREATE TABLE IF NOT EXISTS executions (
  id          TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  status      TEXT NOT NULL,
  input       TEXT,
  output      TEXT,
  error       TEXT,
  steps       INTEGER NOT NULL DEFAULT 0,
  started_at  TEXT NOT NULL,
  finished_at TEXT,
  duration_ms INTEGER,
  FOREIGN KEY (workflow_id) REFERENCES workflows (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_executions_workflow ON executions (workflow_id, started_at DESC);

CREATE TABLE IF NOT EXISTS execution_nodes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  execution_id TEXT NOT NULL,
  node_id      TEXT NOT NULL,
  node_type    TEXT NOT NULL,
  label        TEXT,
  status       TEXT NOT NULL,
  input        TEXT,
  output       TEXT,
  decision     TEXT,
  probability  REAL,
  confidence   REAL,
  error        TEXT,
  started_at   TEXT NOT NULL,
  finished_at  TEXT NOT NULL,
  duration_ms  INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (execution_id) REFERENCES executions (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_execution_nodes_execution ON execution_nodes (execution_id, id);

CREATE TABLE IF NOT EXISTS workflow_endpoints (
  workflow_id    TEXT PRIMARY KEY,
  token          TEXT NOT NULL,
  enabled        INTEGER NOT NULL DEFAULT 1,
  providers_json TEXT,
  published_at   TEXT,
  call_count     INTEGER NOT NULL DEFAULT 0,
  error_count    INTEGER NOT NULL DEFAULT 0,
  last_called_at TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  FOREIGN KEY (workflow_id) REFERENCES workflows (id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_endpoints_token ON workflow_endpoints (token);
`;
