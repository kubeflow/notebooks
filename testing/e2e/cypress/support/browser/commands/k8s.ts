// Browser only (specs, pages, models). See README "Architecture".
// Tier 3: generic commands for any kind (CRDs and core). Prefer a model (Tier 1/2) when one exists.
import {
  type ApplyTaskArgs,
  DEFAULT_WAIT_TIMEOUT_MS,
  describeCondition,
  describeRef,
  type K8sApiError,
  type K8sListQuery,
  type K8sObject,
  type K8sRef,
  refOf,
  type WaitCondition,
  type WaitForDeletionTaskArgs,
  type WaitForTaskArgs,
} from '../../shared/k8s';
import { MANAGED_LABELS } from '../../shared/labels';
import { cleanup } from '../cleanup';

/** Extra time Cypress waits for a k8s task beyond the task's own polling timeout. */
const TASK_MARGIN_MS = 15_000;

export interface K8sApplyOptions {
  /** Register the applied object for automatic cleanup (default true). */
  cleanup?: boolean;
}

export interface K8sWaitOptions {
  timeoutMs?: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Cypress' documented way to type custom commands.
  namespace Cypress {
    interface Chainable {
      /**
       * Server-side applies any object and yields it as stored by the API server.
       * Adds the managed label and registers cleanup (opt out with `{ cleanup: false }`).
       *
       * With `{ expectFailure: true }`, yields the API error instead, and fails the
       * test if the apply succeeds. Nothing is registered for cleanup.
       */
      k8sApply(object: K8sObject, options: { expectFailure: true }): Chainable<K8sApiError>;
      k8sApply<T extends K8sObject>(object: T, options?: K8sApplyOptions): Chainable<T>;
      /** Yields the object; fails if it doesn't exist. */
      k8sGet<T extends K8sObject = K8sObject>(ref: K8sRef): Chainable<T>;
      k8sList<T extends K8sObject = K8sObject>(query: K8sListQuery): Chainable<T[]>;
      /** Requests deletion; succeeds if the object is already gone. Doesn't wait. */
      k8sDelete(ref: K8sRef): Chainable<null>;
      /** Polls until the object exists and matches `condition`; yields it. */
      k8sWaitFor<T extends K8sObject = K8sObject>(
        ref: K8sRef,
        condition?: WaitCondition,
        options?: K8sWaitOptions,
      ): Chainable<T>;
      k8sWaitForDeletion(ref: K8sRef, options?: K8sWaitOptions): Chainable<null>;
    }
  }
}

function waitTaskTimeout(options?: K8sWaitOptions): number {
  return (options?.timeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS) + TASK_MARGIN_MS;
}

function withManagedLabel(object: K8sObject): K8sObject {
  return {
    ...object,
    metadata: {
      ...object.metadata,
      labels: { ...object.metadata.labels, ...MANAGED_LABELS },
    },
  };
}

Cypress.Commands.add(
  'k8sApply',
  (object: K8sObject, options: K8sApplyOptions & { expectFailure?: boolean } = {}) => {
    const name = `${object.kind} ${object.metadata.name ?? '<unnamed>'}`;
    const args: ApplyTaskArgs = {
      object: withManagedLabel(object),
      expectFailure: options.expectFailure,
    };
    Cypress.log({
      name: 'k8sApply',
      message: options.expectFailure ? `${name} (expect failure)` : name,
    });
    // With expectFailure this yields a K8sApiError; the overload above types it for callers.
    return cy.task<K8sObject>('k8sApply', args, { log: false }).then((applied) => {
      if (!options.expectFailure && options.cleanup !== false) {
        cleanup.register(refOf(applied));
      }
      return applied;
    });
  },
);

Cypress.Commands.add('k8sGet', (ref: K8sRef) => {
  Cypress.log({ name: 'k8sGet', message: describeRef(ref) });
  return cy.task('k8sGet', ref, { log: false });
});

Cypress.Commands.add('k8sList', (query: K8sListQuery) => {
  Cypress.log({ name: 'k8sList', message: `${query.kind} ${query.labelSelector ?? ''}`.trim() });
  return cy.task('k8sList', query, { log: false });
});

Cypress.Commands.add('k8sDelete', (ref: K8sRef) => {
  Cypress.log({ name: 'k8sDelete', message: describeRef(ref) });
  return cy.task('k8sDelete', ref, { log: false });
});

Cypress.Commands.add(
  'k8sWaitFor',
  (ref: K8sRef, condition?: WaitCondition, options?: K8sWaitOptions) => {
    const args: WaitForTaskArgs = { ref, condition, timeoutMs: options?.timeoutMs };
    Cypress.log({
      name: 'k8sWaitFor',
      message: `${describeRef(ref)}${condition ? `: ${describeCondition(condition)}` : ''}`,
    });
    return cy.task('k8sWaitFor', args, { log: false, timeout: waitTaskTimeout(options) });
  },
);

Cypress.Commands.add('k8sWaitForDeletion', (ref: K8sRef, options?: K8sWaitOptions) => {
  const args: WaitForDeletionTaskArgs = { ref, timeoutMs: options?.timeoutMs };
  Cypress.log({ name: 'k8sWaitForDeletion', message: describeRef(ref) });
  return cy.task('k8sWaitForDeletion', args, { log: false, timeout: waitTaskTimeout(options) });
});

export {};
