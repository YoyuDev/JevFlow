import type { WorkflowEdge, WorkflowNode } from '@jevflow/core';
import { isNodeType } from '@jevflow/core';
import { HttpError } from '../errors.js';
import { isRecord, readString } from '../utils.js';

export interface ParsedWorkflowBody {
  name?: string;
  description?: string;
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
}

/**
 * Validates an incoming workflow payload.
 *
 * Hand-rolled instead of pulling in a schema library: the payload has exactly
 * three shapes (name/description/nodes/edges) and hand-written messages are
 * more useful to whoever is wiring up the API.
 */
export function parseWorkflowBody(body: unknown): ParsedWorkflowBody {
  if (!isRecord(body)) {
    throw HttpError.badRequest('INVALID_BODY', 'Request body must be a JSON object');
  }

  const parsed: ParsedWorkflowBody = {};

  if (body['name'] !== undefined) {
    const name = readString(body['name'])?.trim();
    if (!name) throw HttpError.badRequest('INVALID_NAME', '`name` must be a non-empty string');
    if (name.length > 120)
      throw HttpError.badRequest('INVALID_NAME', '`name` must be at most 120 characters');
    parsed.name = name;
  }

  if (body['description'] !== undefined && body['description'] !== null) {
    const description = readString(body['description']);
    if (description === undefined) {
      throw HttpError.badRequest('INVALID_DESCRIPTION', '`description` must be a string');
    }
    parsed.description = description.slice(0, 500);
  }

  if (body['nodes'] !== undefined) {
    const nodes = body['nodes'];
    if (!Array.isArray(nodes)) {
      throw HttpError.badRequest('INVALID_NODES', '`nodes` must be an array');
    }
    parsed.nodes = nodes.map((node, index) => parseNode(node, index));
  }

  if (body['edges'] !== undefined) {
    const edges = body['edges'];
    if (!Array.isArray(edges)) {
      throw HttpError.badRequest('INVALID_EDGES', '`edges` must be an array');
    }
    parsed.edges = edges.map((edge, index) => parseEdge(edge, index));
  }

  return parsed;
}

function parseNode(value: unknown, index: number): WorkflowNode {
  if (!isRecord(value)) {
    throw HttpError.badRequest('INVALID_NODES', `nodes[${index}] must be an object`);
  }
  const id = readString(value['id'])?.trim();
  if (!id) throw HttpError.badRequest('INVALID_NODES', `nodes[${index}].id is required`);

  const type = value['type'];
  if (!isNodeType(type)) {
    throw HttpError.badRequest(
      'INVALID_NODES',
      `nodes[${index}].type "${String(type)}" is not a known node type`,
      {
        allowed: ['start', 'llm', 'jev', 'tool', 'end'],
      },
    );
  }

  const position = value['position'];
  if (!isRecord(position)) {
    throw HttpError.badRequest('INVALID_NODES', `nodes[${index}].position is required`);
  }
  const x = position['x'];
  const y = position['y'];
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) {
    throw HttpError.badRequest('INVALID_NODES', `nodes[${index}].position needs numeric x and y`);
  }

  const label = readString(value['label'])?.trim();
  const config = value['config'];

  return {
    id,
    type,
    position: { x, y },
    ...(label ? { label } : {}),
    ...(isRecord(config) ? { config } : {}),
  };
}

function parseEdge(value: unknown, index: number): WorkflowEdge {
  if (!isRecord(value)) {
    throw HttpError.badRequest('INVALID_EDGES', `edges[${index}] must be an object`);
  }
  const source = readString(value['source'])?.trim();
  const target = readString(value['target'])?.trim();
  if (!source || !target) {
    throw HttpError.badRequest('INVALID_EDGES', `edges[${index}] needs both source and target`);
  }
  const id = readString(value['id'])?.trim() || `edge-${index + 1}`;
  const condition = readString(value['condition'])?.trim();

  return {
    id,
    source,
    target,
    ...(condition ? { condition } : {}),
  };
}

/** Extracts the run payload. `{ input: ... }` or a bare value are both accepted. */
export function parseRunBody(body: unknown): unknown {
  if (body === undefined || body === null) return { input: '' };
  if (isRecord(body) && 'input' in body) return body;
  return { input: body };
}
