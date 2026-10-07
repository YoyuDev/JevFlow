/**
 * `Name: value` line parsing, for the free-form header fields.
 *
 * An API connection is usually set up by copying a header block out of someone
 * else's docs, so a textarea is a better editor than a repeatable key/value
 * widget. Blank lines and `#` comments are skipped; a missing colon makes the
 * line unusable and it is dropped rather than guessed at.
 */
export function parseHeaderLines(text: string | undefined | null): Record<string, string> {
  const headers: Record<string, string> = {};
  if (!text) return headers;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith('#')) continue;

    const colon = line.indexOf(':');
    if (colon <= 0) continue;

    const name = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    if (name.length === 0) continue;

    headers[name] = value;
  }

  return headers;
}

/** Header lookup that ignores case, the way HTTP itself does. */
export function findHeaderName(headers: Record<string, string>, name: string): string | undefined {
  const wanted = name.toLowerCase();
  return Object.keys(headers).find((key) => key.toLowerCase() === wanted);
}
