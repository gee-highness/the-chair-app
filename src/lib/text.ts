// src/lib/text.ts

/** Escapes regex metacharacters so user-typed search text is never
 * interpreted as a pattern (audit fix — prevents both malformed-regex
 * 500s and pathological-backtracking DoS from crafted input). */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
