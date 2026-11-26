// Browser only (specs, pages, models). See README "Architecture".
import type { Actor } from '../shared/actors';
import { environment } from './environment';
import { sharedState } from './sharedState';

const USERID_HEADER = 'kubeflow-userid';

const session = sharedState('session', () => ({ identity: undefined as string | undefined }));

/**
 * Registers the one API intercept that injects the simulated identity. Called by
 * support/e2e.ts before every test. A single intercept reading a mutable identity
 * avoids stacking intercepts, where an older handler can overwrite a newer header.
 */
export function startSession(actor: Actor): void {
  const apiPath = `${new URL(environment.baseUrl).pathname.replace(/\/$/, '')}/api/**`;
  cy.intercept(apiPath, (req) => {
    if (session.identity) {
      req.headers[USERID_HEADER] = session.identity;
    }
  });
  loginAs(actor);
}

/**
 * Switches the simulated user for API calls made from now on. Specs are already
 * logged in as their folder's actor; use this only for multi-user tests.
 * Call it before `visit()`, since the UI reads the user when the page loads.
 *
 * An arbitrary `{ identity }` has no permissions until the test binds some
 * (e.g. a RoleBinding via `cy.k8sApply`).
 */
export function loginAs(who: Actor | { identity: string }): void {
  const identity = typeof who === 'string' ? environment.identities[who] : who.identity;
  cy.then(() => {
    session.identity = identity;
  });
  cy.log(`Logged in as **${identity}**`);
}
