import type {
  Workflow,
  WorkflowDefinition,
  WorkflowEdge,
  WorkflowNode,
  WorkflowSummary,
} from '@jevflow/core';
import { WorkflowError, validateWorkflow } from '@jevflow/core';
import { type Db, parseJsonColumn } from './index.js';

interface WorkflowRow {
  id: string;
  name: string;
  description: string | null;
  version: number;
  definition_json: string;
  created_at: string;
  updated_at: string;
}

export interface CreateWorkflowInput {
  id?: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface UpdateWorkflowInput {
  name?: string;
  description?: string;
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
}

/**
 * All SQL for the `workflows` table lives here.
 * Routes and services never see a `Db` handle.
 */
export class WorkflowRepository {
  private readonly db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  list(): WorkflowSummary[] {
    const rows = this.db
      .prepare(
        'SELECT id, name, description, version, definition_json, created_at, updated_at FROM workflows ORDER BY updated_at DESC',
      )
      .all() as WorkflowRow[];
    return rows.map((row) => this.toSummary(row));
  }

  findById(id: string): Workflow | undefined {
    const row = this.db.prepare('SELECT * FROM workflows WHERE id = ?').get(id) as WorkflowRow | undefined;
    return row ? this.toWorkflow(row) : undefined;
  }

  exists(id: string): boolean {
    const row = this.db.prepare('SELECT 1 AS found FROM workflows WHERE id = ?').get(id);
    return row !== undefined;
  }

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS total FROM workflows').get() as { total: number };
    return row.total;
  }

  create(input: CreateWorkflowInput): Workflow {
    const now = new Date().toISOString();
    const id = input.id ?? createWorkflowId(input.name);
    if (this.exists(id)) {
      throw new WorkflowError('INVALID_WORKFLOW', `Workflow "${id}" already exists`, { id });
    }

    const definition: WorkflowDefinition = {
      nodes: input.nodes,
      edges: input.edges,
    };
    validateWorkflow({
      id,
      name: input.name,
      version: 1,
      createdAt: now,
      updatedAt: now,
      ...definition,
    });

    this.db
      .prepare(
        `INSERT INTO workflows (id, name, description, version, definition_json, created_at, updated_at)
         VALUES (@id, @name, @description, @version, @definition, @createdAt, @updatedAt)`,
      )
      .run({
        id,
        name: input.name,
        description: input.description ?? null,
        version: 1,
        definition: JSON.stringify(definition),
        createdAt: now,
        updatedAt: now,
      });

    return {
      id,
      name: input.name,
      ...(input.description ? { description: input.description } : {}),
      version: 1,
      ...definition,
      createdAt: now,
      updatedAt: now,
    };
  }

  update(id: string, patch: UpdateWorkflowInput): Workflow | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;

    const name = patch.name?.trim() || existing.name;
    const description = patch.description ?? existing.description ?? '';
    const nodes = patch.nodes ?? existing.nodes;
    const edges = patch.edges ?? existing.edges;
    const version = existing.version + 1;
    const updatedAt = new Date().toISOString();

    validateWorkflow({
      id,
      name,
      version,
      createdAt: existing.createdAt,
      updatedAt,
      nodes,
      edges,
    });

    this.db
      .prepare(
        `UPDATE workflows
            SET name = @name, description = @description, version = @version,
                definition_json = @definition, updated_at = @updatedAt
          WHERE id = @id`,
      )
      .run({
        id,
        name,
        description: description.length > 0 ? description : null,
        version,
        definition: JSON.stringify({ nodes, edges }),
        updatedAt,
      });

    return {
      id,
      name,
      ...(description.length > 0 ? { description } : {}),
      version,
      nodes,
      edges,
      createdAt: existing.createdAt,
      updatedAt,
    };
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM workflows WHERE id = ?').run(id);
    return result.changes > 0;
  }

  private toSummary(row: WorkflowRow): WorkflowSummary {
    const definition = (parseJsonColumn(row.definition_json, { nodes: [], edges: [] }) ?? {}) as {
      nodes?: unknown[];
      edges?: unknown[];
    };
    return {
      id: row.id,
      name: row.name,
      ...(row.description ? { description: row.description } : {}),
      version: row.version,
      nodeCount: Array.isArray(definition.nodes) ? definition.nodes.length : 0,
      edgeCount: Array.isArray(definition.edges) ? definition.edges.length : 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private toWorkflow(row: WorkflowRow): Workflow {
    const definition = parseJsonColumn(row.definition_json, null);
    if (definition === null) {
      throw new WorkflowError('INVALID_WORKFLOW', `Workflow "${row.id}" has corrupted definition_json`, {
        id: row.id,
      });
    }
    const parsed = definition as { nodes?: WorkflowNode[]; edges?: WorkflowEdge[] };
    return {
      id: row.id,
      name: row.name,
      ...(row.description ? { description: row.description } : {}),
      version: row.version,
      nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
      edges: Array.isArray(parsed.edges) ? parsed.edges : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

/** `Research Agent` → `research-agent`, plus a short suffix for uniqueness. */
export function createWorkflowId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const base = slug.length > 0 ? slug : 'workflow';
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}
