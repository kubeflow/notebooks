import { NamespacesNamespace } from '~/generated/data-contracts';
import { buildMockNamespace } from '~/shared/mock/mockBuilder';

export const mockNamespaces: NamespacesNamespace[] = [
  buildMockNamespace({ name: 'default' }),
  buildMockNamespace({ name: 'kubeflow' }),
  buildMockNamespace({ name: 'custom-namespace' }),
];
