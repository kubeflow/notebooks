import type { V1ObjectMeta } from '@kubernetes/client-node';
import { defineModel, type Handle } from '../support/browser/defineModel';
import { uniqueName } from '../support/browser/uniqueName';
import type { K8sObject } from '../support/shared/k8s';
import { KINDS } from '../support/shared/kinds';
import { applyOverrides, type Overrides } from '../support/shared/overrides';
import {
  type LoadedSample,
  type WorkspaceKindSample,
  workspaceKindSampleFile,
} from '../support/shared/samples';

export interface WorkspaceKind extends K8sObject {
  metadata: V1ObjectMeta & { name: string };
  spec: {
    spawner: {
      displayName: string;
      description: string;
      hidden?: boolean;
      deprecated?: boolean;
    } & Record<string, unknown>;
  } & Record<string, unknown>;
}

const base = defineModel<WorkspaceKind>({
  ...KINDS.workspaceKind,
  namespaced: false,
  namePrefix: 'wsk',
  defaults: () => {
    // A valid WorkspaceKind is large, so it comes from the controller samples instead.
    throw new Error(
      'workspaceKind.create() has no defaults: use workspaceKind.createFromSample(), ' +
        'or pass a complete object with { defaults: false }.',
    );
  },
});

export const workspaceKind = {
  ...base,

  /**
   * Creates a WorkspaceKind from a controller sample (e.g. `'jupyterlab'` →
   * `jupyterlab_v1beta1_workspacekind.yaml`) under a unique name, and registers
   * it for cleanup. `overrides` apply to the sample like `create()` overrides do;
   * the name is always the generated one.
   */
  createFromSample(sample: WorkspaceKindSample, overrides?: Overrides<WorkspaceKind>): Handle {
    const handle = base.track(uniqueName(sample));
    workspaceKind.loadSample(sample, { name: handle.name }).then(({ object }) => {
      const kind = applyOverrides(object as WorkspaceKind, overrides);
      kind.metadata.name = handle.name;
      cy.k8sApply(kind, { cleanup: false });
    });
    return handle;
  },

  /**
   * Yields a controller sample as an object and as YAML (e.g. for a UI upload), renamed to
   * `name` and labelled for cleanup. Doesn't apply or register anything.
   */
  loadSample(
    sample: WorkspaceKindSample,
    { name }: { name: string },
  ): Cypress.Chainable<LoadedSample> {
    return cy.task<LoadedSample>(
      'loadSample',
      { file: workspaceKindSampleFile(sample), name },
      { log: false },
    );
  },

  /** Waits until the WorkspaceKind exists (it has no readiness state); yields it. */
  waitForExists(name: string, options?: { timeoutMs?: number }): Cypress.Chainable<WorkspaceKind> {
    return base.waitFor(name, undefined, options);
  },
};
