const USERID_HEADER = 'kubeflow-userid';

export function loginAsAdmin(): void {
  cy.intercept('/workspaces/api/**', (req) => {
    req.headers[USERID_HEADER] = 'admin@e2e.test';
  });
}

export function loginAsUser(): void {
  cy.intercept('/workspaces/api/**', (req) => {
    req.headers[USERID_HEADER] = 'user@e2e.test';
  });
}
