/** Mirrors `@jevflow/core`'s HTTP defaults — the Studio does not depend on core. */
export const DEFAULT_API_AUTH_HEADER = 'Authorization';
export const DEFAULT_API_AUTH_SCHEME = 'Bearer ';

/** Verbs the HTTP node editor offers. */
export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
