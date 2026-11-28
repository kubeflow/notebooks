import type { V1ObjectMeta } from '@kubernetes/client-node';
import { defineModel } from '../support/browser/defineModel';
import { environment } from '../support/browser/environment';
import type { K8sObject } from '../support/shared/k8s';
import { KINDS } from '../support/shared/kinds';

/** Mirrors `WorkspaceState` in workspaces/controller/api/v1beta1/workspace_types.go. */
export const WorkspaceState = {
  Running: 'Running',
  Terminating: 'Terminating',
  Paused: 'Paused',
  Pending: 'Pending',
  Error: 'Error',
  Unknown: 'Unknown',
} as const;
export type WorkspaceState = (typeof WorkspaceState)[keyof typeof WorkspaceState];

export interface Workspace extends K8sObject {
  metadata: V1ObjectMeta & { name: string; namespace: string };
  spec: {
    kind: string;
    paused?: boolean;
    podTemplate: {
      volumes: {
        home?: string;
        data?: { pvcName: string; mountPath: string; readOnly?: boolean }[];
        secrets?: { secretName: string; mountPath: string; defaultMode?: number }[];
      };
      options: { imageConfig: string; podConfig: string };
    };
  };
  status?: { state?: WorkspaceState; stateMessage?: string };
}

const base = defineModel<Workspace>({
  ...KINDS.workspace,
  namespaced: true,
  namePrefix: 'ws',
  // The smallest valid Workspace: baseline kind and options, no volumes.
  defaults: ({ name, namespace }) => ({
    metadata: { name, namespace: namespace as string },
    spec: {
      kind: environment.baseline.workspaceKind,
      podTemplate: {
        volumes: {},
        options: {
          imageConfig: environment.baseline.imageConfig,
          podConfig: environment.baseline.podConfig,
        },
      },
    },
  }),
});

export const workspace = {
  ...base,

  /** Waits until `status.state` is `state` (`Running` implies the pod is ready); yields the Workspace. */
  waitForState(
    name: string,
    state: WorkspaceState,
    options?: { namespace?: string; timeoutMs?: number },
  ): Cypress.Chainable<Workspace> {
    return base.waitFor(
      name,
      { path: 'status.state', equals: state },
      {
        timeoutMs: 3 * 60_000,
        ...options,
      },
    );
  },
};
