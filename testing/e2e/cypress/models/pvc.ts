import type {
  V1ObjectMeta,
  V1PersistentVolumeClaim,
  V1PersistentVolumeClaimSpec,
} from '@kubernetes/client-node';
import { defineModel } from '../support/browser/defineModel';
import type { K8sObject } from '../support/shared/k8s';
import { KINDS } from '../support/shared/kinds';
import { CAN_MOUNT_LABELS } from '../support/shared/labels';

export type PersistentVolumeClaim = K8sObject &
  V1PersistentVolumeClaim & {
    metadata: V1ObjectMeta & { name: string; namespace: string };
    spec: V1PersistentVolumeClaimSpec;
  };

/** A small mountable PVC on the cluster's default StorageClass. */
export const pvc = defineModel<PersistentVolumeClaim>({
  ...KINDS.persistentVolumeClaim,
  namespaced: true,
  namePrefix: 'pvc',
  defaults: ({ name, namespace }) => ({
    metadata: { name, namespace: namespace as string, labels: { ...CAN_MOUNT_LABELS } },
    spec: {
      accessModes: ['ReadWriteOnce'],
      resources: { requests: { storage: '1Gi' } },
    },
  }),
});
