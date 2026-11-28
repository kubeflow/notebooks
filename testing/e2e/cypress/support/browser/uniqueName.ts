// Browser only (specs, pages, models). See README "Architecture".

/**
 * Returns a fresh, DNS-1123-safe name like `ws-mbx9k2l3-a1b2`.
 *
 * Call it inside `it()`/hooks, never at `describe` scope: describe bodies run
 * once, so every test (and every retry) would reuse the same name. Lint flags this.
 */
export function uniqueName(prefix: string): string {
  const safePrefix = prefix
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .slice(0, 40);
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 6).padEnd(4, '0');
  return `${safePrefix}-${timestamp}-${random}`;
}
