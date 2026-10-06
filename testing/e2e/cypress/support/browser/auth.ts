import { environment } from '../environment';

const USERID_HEADER = 'kubeflow-userid';

export function loginAsAdmin(): void {
  cy.intercept('/workspaces/api/**', (req) => {
    req.headers[USERID_HEADER] = environment.identities.admin;
  });
}

export function loginAsUser(): void {
  cy.intercept('/workspaces/api/**', (req) => {
    req.headers[USERID_HEADER] = environment.identities.user;
  });
}
