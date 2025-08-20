import { WorkspaceKindPodConfigValue } from '~/app/types';

export const mockPodConfig: WorkspaceKindPodConfigValue = {
  id: 'pod_config_35',
  displayName: '8000m CPU, 2Gi RAM, 1 GPU',
  description: 'Pod with 8000m CPU, 2Gi RAM, and 1 GPU',
  labels: [
    { key: 'cpu', value: '8000m' },
    { key: 'memory', value: '2Gi' },
  ],
  hidden: false,
  resources: {
    requests: { cpu: '8000m', memory: '2Gi' },
    limits: { 'nvidia.com/gpu': '2' },
  },
};
