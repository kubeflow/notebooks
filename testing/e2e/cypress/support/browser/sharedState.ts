// Browser only (specs, pages, models). See README "Architecture".

/**
 * Cypress bundles the support file and each spec file separately, so a module
 * imported by both is instantiated twice and plain module-level variables are
 * not shared. Both bundles run in the same window, so mutable framework state
 * lives there instead, created once per spec run.
 */
export function sharedState<T extends object>(key: string, init: () => T): T {
  const store = globalThis as unknown as Record<string, unknown>;
  const slot = `__e2e_${key}`;
  store[slot] ??= init();
  return store[slot] as T;
}
