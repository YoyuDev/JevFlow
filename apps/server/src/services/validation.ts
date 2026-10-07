import type { WorkflowEdge, WorkflowNode } from '@jevflow/core';
import { isNodeType } from '@jevflow/core';
import { HttpError } from '../errors.js';
import type { ProviderProfilePayload, RunProviderSelection } from '../types.js';
import { isRecord, readString } from '../utils.js';

/** A workflow realistically references a handful; the cap just bounds the body. */
const MAX_RUN_PROFILES = 50;

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

export interface ParsedRunBody {
  /** Handed to the engine and persisted as the execution input. */
  input: unknown;
  /** Present only when the caller sent the connections a run should use. */
  providers?: RunProviderSelection;
}

/**
 * Extracts the run payload. `{ input: ... }` or a bare value are both accepted.
 *
 * `providers` is peeled off *before* the rest becomes the input: connections
 * travel to the engine and never into the execution row written to SQLite.
 */
export function parseRunBody(body: unknown): ParsedRunBody {
  if (body === undefined || body === null) return { input: { input: '' } };
  if (!isRecord(body)) return { input: { input: body } };

  const providers = parseProviderSelection(body['providers']);
  const rest: Record<string, unknown> = { ...body };
  delete rest['providers'];

  return {
    input: 'input' in rest ? rest : { input: rest },
    ...(providers ? { providers } : {}),
  };
}

/** `undefined` when the caller did not send any connection for this run. */
function parseProviderSelection(value: unknown): RunProviderSelection | undefined {
  if (!isRecord(value)) return undefined;
  const raw = value['profiles'];
  if (!Array.isArray(raw)) return undefined;

  const profiles = raw
    .map((item) => parseProfile(item))
    .filter((item): item is ProviderProfilePayload => item !== null)
    .slice(0, MAX_RUN_PROFILES);
  return profiles.length > 0 ? { profiles } : undefined;
}

/** A malformed entry is dropped rather than rejected: one bad connection must
 *  not sink an unrelated run, and a node pointing at it simply falls back. */
function parseProfile(value: unknown): ProviderProfilePayload | null {
  if (!isRecord(value)) return null;
  const id = readString(value['id'])?.trim();
  const kind = value['kind'];
  if (!id || (kind !== 'llm' && kind !== 'jev')) return null;

  const label = readString(value['label'])?.trim();
  return {
    id,
    kind,
    apiKey: readString(value['apiKey'])?.trim() ?? '',
    baseUrl: readString(value['baseUrl'])?.trim() ?? '',
    model: readString(value['model'])?.trim() ?? '',
    ...(label ? { label } : {}),
  };
}

export interface ParsedEndpointBody {
  /** Present only when the Studio sent a snapshot of the connections in use. */
  providers?: ProviderProfilePayload[];
  rotate?: boolean;
  enabled?: boolean;
}

/**
 * Validates a publish/update request for a workflow's public endpoint.
 *
 * An empty body is legal and means “publish with whatever is already stored”,
 * which is what a republish after a name change looks like.
 */
export function parseEndpointBody(body: unknown): ParsedEndpointBody {
  if (body === undefined || body === null) return {};
  if (!isRecord(body)) {
    throw HttpError.badRequest('INVALID_BODY', 'Request body must be a JSON object');
  }

  const parsed: ParsedEndpointBody = {};

  if (body['providers'] !== undefined) {
    const raw = body['providers'];
    if (!Array.isArray(raw)) {
      throw HttpError.badRequest('INVALID_PROVIDERS', '`providers` must be an array');
    }
    parsed.providers = raw
      .map((item) => parseProfile(item))
      .filter((item): item is ProviderProfilePayload => item !== null)
      .slice(0, MAX_RUN_PROFILES);
  }

  if (body['rotate'] !== undefined) {
    if (typeof body['rotate'] !== 'boolean') {
      throw HttpError.badRequest('INVALID_ROTATE', '`rotate` must be a boolean');
    }
    parsed.rotate = body['rotate'];
  }

  if (body['enabled'] !== undefined) {
    if (typeof body['enabled'] !== 'boolean') {
      throw HttpError.badRequest('INVALID_ENABLED', '`enabled` must be a boolean');
    }
    parsed.enabled = body['enabled'];
  }

  return parsed;
}
