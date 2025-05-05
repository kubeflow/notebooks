import { buildMockNamespace } from '~/shared/mock/mockBuilder';
import { Namespace } from '~/shared/types';

export const mockNamespaces: Namespace[] = [
  buildMockNamespace({ name: 'default' }),
  buildMockNamespace({ name: 'kubeflow' }),
  buildMockNamespace({ name: 'custom-namespace' }),
];
