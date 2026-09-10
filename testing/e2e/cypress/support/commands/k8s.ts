interface K8sResourceParams {
  group: string;
  version: string;
  plural: string;
  namespace?: string;
  name: string;
}

interface K8sWaitParams extends K8sResourceParams {
  timeoutMs?: number;
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

export {};
