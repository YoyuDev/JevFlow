import type { NodeExecutionRecord } from '@jevflow/core';
import { type Db, parseJsonColumn, serializeJson } from './index.js';
import type { ExecutionRecord, NodeRunRecord } from '../types.js';

interface ExecutionRow {
  id: string;
  workflow_id: string;
  status: string;
  input: string | null;
  output: string | null;
  error: string | null;
  steps: number;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
}

interface ExecutionNodeRow {
  id: number;
  execution_id: string;
  node_id: string;
  node_type: string;
  label: string | null;
  status: string;
  input: string | null;
  output: string | null;
  decision: string | null;
  probability: number | null;
  confidence: number | null;
  error: string | null;
  started_at: string;
  finished_at: string;
  duration_ms: number;
}

export interface CreateExecutionInput {
  id: string;
  workflowId: string;
  input: unknown;
  startedAt: string;
}

export interface FinishExecutionInput {
  id: string;
  status: 'completed' | 'failed';
  output: unknown;
  error?: string;
  steps: number;
  finishedAt: string;
  durationMs: number;
}

/** All SQL for `executions` and `execution_nodes`. */
export class ExecutionRepository {
  private readonly db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  createExecution(input: CreateExecutionInput): void {
    this.db
      .prepare(
        `INSERT INTO executions (id, workflow_id, status, input, started_at)
         VALUES (@id, @workflowId, 'running', @input, @startedAt)`,
      )
      .run({
        id: input.id,
        workflowId: input.workflowId,
        input: serializeJson(input.input),
        startedAt: input.startedAt,
      });
  }

  finishExecution(input: FinishExecutionInput): void {
    this.db
      .prepare(
        `UPDATE executions
            SET status = @status, output = @output, error = @error,
                steps = @steps, finished_at = @finishedAt, duration_ms = @durationMs
          WHERE id = @id`,
      )
      .run({
        id: input.id,
        status: input.status,
        output: serializeJson(input.output),
        error: input.error ?? null,
        steps: input.steps,
        finishedAt: input.finishedAt,
        durationMs: input.durationMs,
      });
  }

  /** Appends one trace line. Called from the engine's `onNodeFinish` hook. */
  insertNodeRecord(executionId: string, record: NodeExecutionRecord): void {
    this.db
      .prepare(
        `INSERT INTO execution_nodes
           (execution_id, node_id, node_type, label, status, input, output, decision,
            probability, confidence, error, started_at, finished_at, duration_ms)
         VALUES (@executionId, @nodeId, @nodeType, @label, @status, @input, @output, @decision,
            @probability, @confidence, @error, @startedAt, @finishedAt, @durationMs)`,
      )
      .run({
        executionId,
        nodeId: record.nodeId,
        nodeType: record.nodeType,
        label: record.label,
        status: record.status,
        input: serializeJson(record.input),
        output: serializeJson(record.output),
        decision: record.decision ? serializeJson(record.decision) : null,
        probability: record.probability ?? null,
        confidence: record.confidence ?? null,
        error: record.error ?? null,
        startedAt: record.startedAt,
        finishedAt: record.finishedAt,
        durationMs: record.durationMs,
      });
  }

  findExecution(id: string): ExecutionRecord | undefined {
    const row = this.db.prepare('SELECT * FROM executions WHERE id = ?').get(id) as ExecutionRow | undefined;
    return row ? toExecution(row) : undefined;
  }

  listByWorkflow(workflowId: string, limit = 20): ExecutionRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM executions WHERE workflow_id = ? ORDER BY started_at DESC LIMIT ?')
      .all(workflowId, limit) as ExecutionRow[];
    return rows.map(toExecution);
  }

  listNodeRecords(executionId: string): NodeRunRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM execution_nodes WHERE execution_id = ? ORDER BY id ASC')
      .all(executionId) as ExecutionNodeRow[];
    return rows.map(toNodeRunRecord);
  }
}

function toExecution(row: ExecutionRow): ExecutionRecord {
  const status =
    row.status === 'completed' || row.status === 'failed' || row.status === 'running' ? row.status : 'failed';
  return {
    id: row.id,
    workflowId: row.workflow_id,
    status,
    input: parseJsonColumn(row.input, null),
    output: parseJsonColumn(row.output, null),
    error: row.error,
    steps: row.steps,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    durationMs: row.duration_ms,
  };
}

function toNodeRunRecord(row: ExecutionNodeRow): NodeRunRecord {
  const decision = parseJsonColumn(row.decision, null);
  return {
    id: String(row.id),
    executionId: row.execution_id,
    nodeId: row.node_id,
    nodeType: row.node_type as NodeRunRecord['nodeType'],
    label: row.label ?? row.node_id,
    status: row.status as NodeRunRecord['status'],
    input: parseJsonColumn(row.input, null),
    output: parseJsonColumn(row.output, null),
    decision: decision as NodeRunRecord['decision'],
    probability: row.probability,
    confidence: row.confidence,
    error: row.error,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    durationMs: row.duration_ms,
  };
}
