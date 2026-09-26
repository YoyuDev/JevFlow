const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

/**
 * Short, sortable-ish, human-readable id: `exec-m4x9k1-7f3a2c`.
 * Time prefix keeps ids roughly ordered; suffix keeps them unique.
 */
export function createId(prefix: string): string {
  const time = Date.now().toString(36);
  let suffix = '';
  for (let i = 0; i < 6; i += 1) {
    suffix += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `${prefix}-${time}-${suffix}`;
}
