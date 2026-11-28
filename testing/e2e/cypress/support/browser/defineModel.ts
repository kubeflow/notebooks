// Browser only (specs, pages, models). See README "Architecture".
// Tiers 1-2: typed helpers for one kind, built on the Tier 3 `cy.k8s*` commands.
import { type K8sApiError, type K8sObject, type K8sRef, type WaitCondition } from '../shared/k8s';
import { MANAGED_LABELS } from '../shared/labels';
import { applyOverrides, type Overrides } from '../shared/overrides';
import { cleanup } from './cleanup';
import type { K8sWaitOptions } from './commands/k8s';
import { environment } from './environment';
import { uniqueName } from './uniqueName';

/** What `create()`/`track()` return: plain data, usable immediately (before the apply runs). */
export interface Handle {
  name: string;
  /** Unset for cluster-scoped kinds. */
  namespace?: string;
  /** For Tier 3 commands, e.g. `cy.k8sWaitFor(handle.ref, ...)`. */
  ref: K8sRef;
}

export interface CreateOptions {
  /**
   * `false`: the first argument is the complete object, used as-is except that a
   * missing name/namespace is generated and the managed label is added.
   */
  defaults?: boolean;
  /** `false`: don't delete it after the test (the next run's sweep still will). */
  cleanup?: boolean;
}

export interface ModelOptions {
  /** Defaults to `environment.namespace` for namespaced kinds. */
  namespace?: string;
}

export interface WaitOptions extends ModelOptions, K8sWaitOptions {}

/**
 * `T` without `apiVersion`/`kind`. Unlike `Omit`, which collapses to `{ [key: string]: unknown }`
 * on `K8sObject`'s index signature, this keeps the declared fields type-checked.
 */
type WithoutTypeMeta<T> = { [K in keyof T as K extends 'apiVersion' | 'kind' ? never : K]: T[K] };

export interface ModelDefinition<T extends K8sObject> {
  apiVersion: string;
  kind: string;
  namespaced: boolean;
  /** Prefix for generated names, e.g. `ws` → `ws-mbx9k2l3-a1b2`. */
  namePrefix: string;
  /**
   * A valid object for "any X will do" tests: keep it minimal. Receives the generated
   * name/namespace; `apiVersion`, `kind` and the managed label are added for you.
   */
  defaults: (meta: { name: string; namespace?: string }) => WithoutTypeMeta<T>;
}

export interface Model<T extends K8sObject> {
  readonly apiVersion: string;
  readonly kind: string;
  /**
   * Creates an object (defaults + overrides) and registers it for cleanup.
   * Returns synchronously; the apply runs in the Cypress command queue.
   *
   * With `{ expectFailure: true }`, yields the API error instead (and fails the test
   * if the apply succeeds). Nothing is registered for cleanup.
   */
  create(
    overrides: Overrides<T> | undefined,
    options: CreateOptions & { expectFailure: true },
  ): Cypress.Chainable<K8sApiError>;
  create(overrides?: Overrides<T>, options?: CreateOptions): Handle;
  get(name: string, options?: ModelOptions): Cypress.Chainable<T>;
  /** Polls until the object exists and matches `condition` (or just exists); yields it. */
  waitFor(name: string, condition?: WaitCondition, options?: WaitOptions): Cypress.Chainable<T>;
  waitForDeletion(name: string, options?: WaitOptions): Cypress.Chainable<null>;
  deleteAndWait(name: string, options?: WaitOptions): Cypress.Chainable<null>;
  /**
   * Registers an object something else will create (usually the UI) for cleanup.
   * Call it before the UI step, so it's cleaned up even if the test fails midway.
   */
  track(name: string, options?: ModelOptions): Handle;
  ref(name: string, options?: ModelOptions): K8sRef;
}

/** Builds the standard helpers for one kind. Add kind-specific helpers by spreading the result. */
export function defineModel<T extends K8sObject>(definition: ModelDefinition<T>): Model<T> {
  const { apiVersion, kind, namespaced, namePrefix } = definition;

  const ref = (name: string, options?: ModelOptions): K8sRef => ({
    apiVersion,
    kind,
    name,
    ...(namespaced ? { namespace: options?.namespace ?? environment.namespace } : {}),
  });

  const handleOf = (name: string, options?: ModelOptions): Handle => {
    const r = ref(name, options);
    return { name, namespace: r.namespace, ref: r };
  };

  const build = (overrides: Overrides<T> | undefined, useDefaults: boolean): T => {
    const name = uniqueName(namePrefix);
    const namespace = namespaced ? environment.namespace : undefined;
    let object: T;
    if (useDefaults) {
      const defaults = { apiVersion, kind, ...definition.defaults({ name, namespace }) } as T;
      object = applyOverrides(defaults, overrides);
    } else {
      if (typeof overrides !== 'object') {
        throw new Error(`${kind}.create(object, { defaults: false }) needs the complete object`);
      }
      object = structuredClone(overrides) as T;
    }
    // Filled after overrides, so an override can choose its own name/namespace.
    object.metadata = { ...object.metadata };
    object.metadata.name ??= name;
    if (namespaced) {
      object.metadata.namespace ??= namespace;
    }
    object.metadata.labels = { ...object.metadata.labels, ...MANAGED_LABELS };
    return object;
  };

  function create(
    overrides?: Overrides<T>,
    options: CreateOptions & { expectFailure?: boolean } = {},
  ): Handle | Cypress.Chainable<K8sApiError> {
    const object = build(overrides, options.defaults !== false);
    if (options.expectFailure) {
      return cy.k8sApply(object, { expectFailure: true });
    }
    const handle = handleOf(object.metadata.name as string, {
      namespace: object.metadata.namespace,
    });
    // Registered before the apply runs, so a failed apply or test still cleans up.
    if (options.cleanup !== false) {
      cleanup.register(handle.ref);
    }
    cy.k8sApply(object, { cleanup: false });
    return handle;
  }

  return {
    apiVersion,
    kind,
    create: create as Model<T>['create'],
    get: (name, options) => cy.k8sGet<T>(ref(name, options)),
    waitFor: (name, condition, options) => cy.k8sWaitFor<T>(ref(name, options), condition, options),
    waitForDeletion: (name, options) => cy.k8sWaitForDeletion(ref(name, options), options),
    deleteAndWait: (name, options) =>
      cy
        .k8sDelete(ref(name, options))
        .then(() => cy.k8sWaitForDeletion(ref(name, options), options)),
    track: (name, options) => {
      const handle = handleOf(name, options);
      cleanup.register(handle.ref);
      return handle;
    },
    ref,
  };
}
