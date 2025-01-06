import { NamespacesList } from '~/app/types';

export const mockNamespaces = (): NamespacesList => ({
  data: [{ name: 'default' }, { name: 'kubeflow' }, { name: 'custom-namespace' }],
});
