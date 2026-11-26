import type { V1ObjectMeta, V1Secret } from '@kubernetes/client-node';
import { defineModel } from '../support/browser/defineModel';
import type { K8sObject } from '../support/shared/k8s';
import { KINDS } from '../support/shared/kinds';
import { CAN_MOUNT_LABELS } from '../support/shared/labels';

export type Secret = K8sObject &
  V1Secret & {
    metadata: V1ObjectMeta & { name: string; namespace: string };
  };

/** A small mountable Opaque Secret. */
export const secret = defineModel<Secret>({
  ...KINDS.secret,
  namespaced: true,
  namePrefix: 'secret',
  defaults: ({ name, namespace }) => ({
    metadata: { name, namespace: namespace as string, labels: { ...CAN_MOUNT_LABELS } },
    type: 'Opaque',
    stringData: { key: 'value' },
  }),
});
