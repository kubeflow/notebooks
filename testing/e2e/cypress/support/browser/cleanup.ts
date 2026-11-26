// Browser only (specs, pages, models). See README "Architecture".
import { describeRef, type K8sRef } from '../shared/k8s';
import { sharedState } from './sharedState';

type Scope = 'test' | 'spec';

const CLEANUP_TIMEOUT_MS = 10 * 60_000;

const state = sharedState('cleanup', () => ({
  currentScope: 'spec' as Scope,
  registered: { test: [], spec: [] } as Record<Scope, K8sRef[]>,
}));

/**
 * Deletes registered objects after the test, or after the spec file when
 * registered in a `before()` hook (for expensive setup shared by several tests).
 * Order is reverse registration, so register dependencies first (which happens
 * naturally if you create them first).
 *
 * Models' `create()`/`track()` and `cy.k8sApply` register automatically; call
 * this directly only for objects created some other way.
 */
export const cleanup = {
  register(ref: K8sRef): void {
    state.registered[state.currentScope].push(ref);
  },
};

// Lifecycle hooks below are called only from support/e2e.ts.

export function beginTestScope(): void {
  state.currentScope = 'test';
}

export function endTestScope(): void {
  state.currentScope = 'spec';
}

/**
 * Enqueues deletion of everything registered in `scope`. With `failOnError`,
 * a failed deletion fails the hook; otherwise it's only logged, so a cleanup
 * problem never hides the test's own failure.
 */
export function runCleanup(scope: Scope, failOnError: boolean): void {
  const refs = state.registered[scope].splice(0);
  if (refs.length === 0) {
    return;
  }
  Cypress.log({ name: 'cleanup', message: refs.map(describeRef).join(', ') });
  cy.task<{ failures: string[] }>('k8sCleanup', refs, {
    log: false,
    timeout: CLEANUP_TIMEOUT_MS,
  }).then(({ failures }) => {
    if (failures.length === 0) {
      return;
    }
    const message = `Cleanup failed:\n  ${failures.join('\n  ')}`;
    if (failOnError) {
      throw new Error(message);
    }
    Cypress.log({ name: 'cleanup', message });
  });
}
