import { environment } from '../support/environment';

const GROUP = 'kubeflow.org';
const VERSION = 'v1beta1';
const PLURAL = 'workspaces';

export interface Workspace {
  metadata: {
    name: string;
    namespace: string;
  };
  spec: {
    kind: string;
  } & Record<string, unknown>;
  status?: {
    state?: string;
  } & Record<string, unknown>;
}

/**
 * Domain helpers for the Workspace CRD. Callers never need to know the
 * group/version/plural triple, and get back typed results instead of a raw,
 * generic k8s resource.
 */
export const workspace = {
  get(name: string, namespace = environment.namespace): Cypress.Chainable<Workspace> {
    return cy.k8sGet({
      group: GROUP,
      version: VERSION,
      plural: PLURAL,
      namespace,
      name,
    }) as unknown as Cypress.Chainable<Workspace>;
  },

  delete(name: string, namespace = environment.namespace): Cypress.Chainable<null> {
    return cy.k8sDelete({ group: GROUP, version: VERSION, plural: PLURAL, namespace, name });
  },

  /** Waits until the Workspace's `status.state` reaches `Running` (which implies its underlying StatefulSet is ready). */
  waitForReady(
    name: string,
    namespace = environment.namespace,
    timeoutMs?: number,
  ): Cypress.Chainable<Workspace> {
    return cy.k8sWaitForResource({
      group: GROUP,
      version: VERSION,
      plural: PLURAL,
      namespace,
      name,
      timeoutMs,
      condition: { path: ['status', 'state'], value: 'Running' },
    }) as unknown as Cypress.Chainable<Workspace>;
  },

  /** Deletes the Workspace and waits until it is fully removed from the cluster. */
  waitForDeleted(
    name: string,
    namespace = environment.namespace,
    timeoutMs?: number,
  ): Cypress.Chainable<null> {
    return workspace
      .delete(name, namespace)
      .then(() =>
        cy.k8sWaitForDeletion({ group: GROUP, version: VERSION, plural: PLURAL, namespace, name, timeoutMs }),
      );
  },
};
