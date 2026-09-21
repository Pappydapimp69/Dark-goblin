/**
 * Canonical (sorted-key) serialization + a fingerprint over it.
 *
 * Used by the determinism tests to compare states step by step: two runs that
 * agree only on their END state can still have diverged mid-run, so the
 * fingerprint is taken after every interaction, not once at the review.
 */

export function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`);
  return `{${entries.join(",")}}`;
}

/** FNV-1a over the canonical form. Deterministic across processes. */
export function fingerprint(value: unknown): string {
  const text = canonical(value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
