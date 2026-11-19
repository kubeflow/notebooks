const GROUP = 'kubeflow.org';
const VERSION = 'v1beta1';
const PLURAL = 'workspacekinds';

export interface WorkspaceKind {
  metadata: {
    name: string;
  };
  spec: {
    spawner: Record<string, unknown>;
  } & Record<string, unknown>;
}

/**
 * Domain helpers for the (cluster-scoped) WorkspaceKind CRD. Callers never
 * need to know the group/version/plural triple, and get back typed results
 * instead of a raw, generic k8s resource.
 */
export const workspaceKind = {
  get(name: string): Cypress.Chainable<WorkspaceKind> {
    return cy.k8sGet({ group: GROUP, version: VERSION, plural: PLURAL, name }) as unknown as Cypress.Chainable<WorkspaceKind>;
  },

  delete(name: string): Cypress.Chainable<null> {
    return cy.k8sDelete({ group: GROUP, version: VERSION, plural: PLURAL, name });
  },

  /** Waits until the WorkspaceKind is visible in the cluster (there is no further "readiness" state for this CRD). */
  waitForExists(name: string, timeoutMs?: number): Cypress.Chainable<WorkspaceKind> {
    return cy.k8sWaitForResource({
      group: GROUP,
      version: VERSION,
      plural: PLURAL,
      name,
      timeoutMs,
    }) as unknown as Cypress.Chainable<WorkspaceKind>;
  },

  /** Deletes the WorkspaceKind and waits until it is fully removed from the cluster. */
  waitForDeleted(name: string, timeoutMs?: number): Cypress.Chainable<null> {
    return workspaceKind
      .delete(name)
      .then(() => cy.k8sWaitForDeletion({ group: GROUP, version: VERSION, plural: PLURAL, name, timeoutMs }));
  },
};
