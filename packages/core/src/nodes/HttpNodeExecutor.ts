import {
  DEFAULT_HTTP_AUTH_HEADER,
  DEFAULT_HTTP_AUTH_SCHEME,
} from '../constants.js';
import type {
  ApiProviderHandle,
  NodeExecutionInput,
  NodeExecutionOutput,
  NodeExecutor,
} from '../types/index.js';
import { WorkflowError, toErrorMessage } from '../types/index.js';
import type { FetchLike, FetchResponse } from '../utils/fetch.js';
import { getDefaultFetch, safeReadText } from '../utils/fetch.js';
import { findHeaderName } from '../utils/headers.js';
import { interpolate } from '../utils/interpolate.js';
import { truncate } from '../utils/value.js';
import { resolveHttpConfig } from './nodeConfig.js';

export interface HttpNodeExecutorOptions {
  /** Injected transport — tests pass a stub, everyone else gets `globalThis.fetch`. */
  fetchImpl?: FetchLike;
}

/**
 * Calls an HTTP endpoint and hands the parsed response to the next node.
 *
 * Where it sits in the picture: the **Tool** node runs something already
 * registered in the process, and the **对外 API** feature lets other people's
 * code call *this* workflow. This one is the third direction — the workflow
 * reaching out to a service nobody wired up in advance.
 *
 * The connection (`config.providerId`) owns the base URL and how the secret is
 * attached; the node owns the verb, path, headers and body. So pointing the
 * whole workflow at staging, or rotating a key, is a settings change rather
 * than a canvas change.
 *
 * Templates work in `url`, header values and `body`: `{{input}}`, `{{last}}`,
 * `{{<node-id>}}`. The parsed payload is what downstream nodes see, and it is
 * also kept in the `lastHttp` variable.
 */
export class HttpNodeExecutor implements NodeExecutor {
  readonly type = 'http' as const;

  private readonly fetchImpl: FetchLike | undefined;

  constructor(options: HttpNodeExecutorOptions = {}) {
    this.fetchImpl = options.fetchImpl;
  }

  async execute({ node, context, deps }: NodeExecutionInput): Promise<NodeExecutionOutput> {
    const config = resolveHttpConfig(node);
    const scope = context.buildScope();
    const connection = config.providerId ? deps.providers?.api?.(config.providerId) : undefined;

    const url = resolveUrl(connection?.baseUrl ?? '', interpolate(config.url, scope));
    if (url.length === 0) {
      throw new WorkflowError(
        'HTTP_FAILED',
        connection
          ? `HTTP node "${node.id}" has an empty path, and connection "${connection.label}" has no base URL to fall back on`
          : `HTTP node "${node.id}" has no URL, and no connection is selected to provide a base URL`,
        { nodeId: node.id, providerId: config.providerId ?? null },
      );
    }

    // GET and HEAD cannot carry a body — `fetch` throws outright if they try.
    const body = config.method === 'GET' ? undefined : firstNonEmpty(interpolate(config.body ?? '', scope));
    const headers = buildHeaders(connection, config.headers, scope, body !== undefined);

    const doFetch = this.fetchImpl ?? getDefaultFetch();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    const startedAt = Date.now();

    let response: FetchResponse;
    let text: string;
    try {
      response = await doFetch(url, {
        method: config.method,
        headers,
        ...(body === undefined ? {} : { body }),
        signal: controller.signal,
      });
      text = await safeReadText(response);
    } catch (error) {
      const timedOut = controller.signal.aborted;
      throw new WorkflowError(
        'HTTP_FAILED',
        timedOut
          ? `${config.method} ${url} timed out after ${config.timeoutMs}ms`
          : `${config.method} ${url} could not be reached: ${toErrorMessage(error)}`,
        {
          nodeId: node.id,
          method: config.method,
          url,
          timeoutMs: config.timeoutMs,
          ...(timedOut ? {} : { cause: toErrorMessage(error) }),
        },
      );
    } finally {
      clearTimeout(timer);
    }

    const durationMs = Date.now() - startedAt;
    const payload = parsePayload(text);
    const meta = {
      method: config.method,
      url,
      status: response.status,
      durationMs,
      ...(connection ? { connection: connection.label } : {}),
    };

    if (!response.ok && config.failOnError) {
      throw new WorkflowError(
        'HTTP_FAILED',
        `${config.method} ${url} → ${statusLine(response)}`,
        {
          nodeId: node.id,
          method: config.method,
          url,
          status: response.status,
          durationMs,
          body: truncate(text.replace(/\s+/g, ' ').trim(), 300),
        },
      );
    }

    // A tolerated failure is passed on as a fact the rest of the workflow can
    // branch on — `{ ok: false }` rather than a thrown error. This is what makes
    // “try to enrich, but carry on without it” expressible with a Jev node.
    const output = response.ok
      ? payload
      : { ok: false, status: response.status, statusText: response.statusText ?? '', body: payload };

    context.setVariable('lastHttp', output);

    return { output, meta };
  }
}

/* --------------------------------- helpers -------------------------------- */

/**
 * Joins the connection's base URL with the node's path.
 *
 * An absolute `https://…` url wins outright, which is what lets one node call
 * an unrelated host without a connection of its own — and what keeps the node
 * usable in a plain `@jevflow/core` embedding that has no registry at all.
 */
export function resolveUrl(baseUrl: string, path: string): string {
  const target = path.trim();
  if (target.length === 0) return '';
  if (/^https?:\/\//i.test(target)) return target;

  const base = baseUrl.trim().replace(/\/+$/, '');
  if (base.length === 0) return '';
  return `${base}/${target.replace(/^\/+/, '')}`;
}

/** Connection headers first, then the auth header, then the node's own wins. */
function buildHeaders(
  connection: ApiProviderHandle | undefined,
  nodeHeaders: Record<string, string>,
  scope: Record<string, unknown>,
  hasBody: boolean,
): Record<string, string> {
  const headers: Record<string, string> = { ...(connection?.headers ?? {}) };

  const key = connection?.apiKey?.trim();
  if (key) {
    const name = connection?.authHeader?.trim() || DEFAULT_HTTP_AUTH_HEADER;
    const scheme = connection?.authScheme ?? DEFAULT_HTTP_AUTH_SCHEME;
    headers[name] = `${scheme}${key}`;
  }

  for (const [name, value] of Object.entries(nodeHeaders)) {
    headers[name] = interpolate(value, scope);
  }

  // Bodies are JSON the overwhelming majority of the time; a missing
  // content-type is the usual reason a perfectly good request comes back 415.
  // Set only as a default — an explicit header always wins.
  if (hasBody && !findHeaderName(headers, 'content-type')) headers['content-type'] = 'application/json';

  return headers;
}

/** `''` and whitespace-only bodies are dropped rather than sent as empty. */
function firstNonEmpty(value: string): string | undefined {
  return value.trim().length > 0 ? value : undefined;
}

/** JSON when it parses, the raw text otherwise, `null` for an empty body. */
function parsePayload(text: string): unknown {
  if (text.trim().length === 0) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function statusLine(response: FetchResponse): string {
  return `${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;
}
