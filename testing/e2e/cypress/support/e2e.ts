import '@testing-library/cypress/add-commands';
import './browser/commands/k8s';
import { loginAsAdmin, loginAsUser } from './browser/auth';

before(() => {
  cy.task('setupE2e', null, { timeout: 120_000 });
});

// Maps the `actor` segment of the (CRD, actor, page-area) spec path convention
// (e.g. `cypress/tests/workspace/user/create.cy.ts`, see README.md) to the login
// it implies, so individual specs don't need to repeat `beforeEach(() => loginAsX())`.
const ACTOR_LOGINS: Record<string, () => void> = {
  admin: loginAsAdmin,
  user: loginAsUser,
};

function actorForSpec(relativePath: string): string | undefined {
  // cypress/tests/<crd>/<actor>/<file>.cy.ts
  const segments = relativePath.split('/');
  const testsIndex = segments.indexOf('tests');
  return segments[testsIndex + 2];
}

beforeEach(() => {
  const actor = actorForSpec(Cypress.spec.relative);
  const login = actor && ACTOR_LOGINS[actor];
  if (!login) {
    throw new Error(
      `Could not derive a login from spec path "${Cypress.spec.relative}": expected the ` +
        `(CRD, actor, page-area) convention (e.g. "workspace/user/create.cy.ts"), and an ` +
        `actor of ${Object.keys(ACTOR_LOGINS).join(' or ')}. Add a mapping in ` +
        'cypress/support/e2e.ts if this is a new, valid actor.',
    );
  }
  login();
});
