import { CATCH_ALL_CONDITIONS } from '../constants.js';
import { WorkflowError, type DecisionResult, type WorkflowEdge } from '../types/index.js';

function normalizeCondition(condition: string | undefined): string {
  return (condition ?? '').trim().toLowerCase();
}

function isCatchAll(condition: string | undefined): boolean {
  const normalized = normalizeCondition(condition);
  return normalized === '' || CATCH_ALL_CONDITIONS.includes(normalized);
}

function selectCandidates(edges: WorkflowEdge[], source?: string): WorkflowEdge[] {
  if (!source) return edges;
  return edges.filter((edge) => edge.source === source);
}

/**
 * Turns a `DecisionResult` into the next edge.
 *
 * Resolution order:
 *   1. exact match on `condition === decision.choice` (case-insensitive)
 *   2. a catch-all branch (`default` / `else` / `*` / empty condition)
 *   3. `EDGE_NOT_FOUND` — an unmatched decision is a workflow authoring bug.
 */
export class DecisionRouter {
  route(decision: DecisionResult, edges: WorkflowEdge[], source?: string): WorkflowEdge {
    const candidates = selectCandidates(edges, source);
    if (candidates.length === 0) {
      throw new WorkflowError(
        'EDGE_NOT_FOUND',
        `No outgoing edge found${source ? ` for node "${source}"` : ''}`,
        { source },
      );
    }

    const choice = normalizeCondition(decision.choice);
    const exact = candidates.find((edge) => normalizeCondition(edge.condition) === choice);
    if (exact) return exact;

    const catchAll = candidates.find((edge) => isCatchAll(edge.condition));
    if (catchAll) return catchAll;

    throw new WorkflowError('EDGE_NOT_FOUND', `Decision "${decision.choice}" matched no outgoing edge`, {
      source,
      choice: decision.choice,
      available: candidates.map((edge) => edge.condition ?? '(default)'),
    });
  }

  /**
   * Picks the edge for a non-decision node: the single/default outgoing path.
   * A `default` / `else` / `*` branch is accepted as a fallback.
   */
  routeDefault(edges: WorkflowEdge[], source?: string): WorkflowEdge {
    const candidates = selectCandidates(edges, source);
    if (candidates.length === 0) {
      throw new WorkflowError('EDGE_NOT_FOUND', `Node "${source ?? '?'}" has no outgoing edge`, { source });
    }
    const unlabelled = candidates.find((edge) => normalizeCondition(edge.condition) === '');
    if (unlabelled) return unlabelled;
    const catchAll = candidates.find((edge) => isCatchAll(edge.condition));
    if (catchAll) return catchAll;
    throw new WorkflowError(
      'EDGE_NOT_FOUND',
      `Node "${source ?? '?'}" only has condition-labelled edges; add an unlabelled branch`,
      { source, available: candidates.map((edge) => edge.condition) },
    );
  }

  /** Edges leaving a node — used by the engine and the Studio's branch editor. */
  candidates(edges: WorkflowEdge[], source: string): WorkflowEdge[] {
    return selectCandidates(edges, source);
  }
}
