interface K8sResourceParams {
  group: string;
  version: string;
  plural: string;
  namespace?: string;
  name: string;
}

interface K8sFieldCondition {
  path: string[];
  value: unknown;
}

interface K8sWaitParams extends K8sResourceParams {
  timeoutMs?: number;
  condition?: K8sFieldCondition;
}

export interface K8sResource {
  metadata: {
    name: string;
    namespace?: string;
  };
  spec: Record<string, unknown>;
  status?: Record<string, unknown>;
}

declare global {
  namespace Cypress {
    interface Chainable {
      k8sGet(params: K8sResourceParams): Chainable<K8sResource>;
      k8sDelete(params: K8sResourceParams): Chainable<null>;
      k8sWaitForResource(params: K8sWaitParams): Chainable<K8sResource>;
      k8sWaitForDeletion(params: K8sResourceParams & { timeoutMs?: number }): Chainable<null>;
    }
  }
}

Cypress.Commands.add('k8sGet', (params: K8sResourceParams) =>
  cy.task('k8sGet', params),
);

Cypress.Commands.add('k8sDelete', (params: K8sResourceParams) =>
  cy.task('k8sDelete', params),
);

Cypress.Commands.add('k8sWaitForResource', (params: K8sWaitParams) =>
  cy.task('k8sWaitForResource', params, { timeout: (params.timeoutMs ?? 60_000) + 10_000 }),
);

Cypress.Commands.add(
  'k8sWaitForDeletion',
  (params: K8sResourceParams & { timeoutMs?: number }) =>
    cy.task('k8sWaitForDeletion', params, { timeout: (params.timeoutMs ?? 60_000) + 10_000 }),
);

export {};
