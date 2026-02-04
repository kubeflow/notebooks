import { Namespace, useNamespaceSelector } from 'mod-arch-core';

type UseNamespaceSelectorWrapperReturn = Omit<
  ReturnType<typeof useNamespaceSelector>,
  'preferredNamespace'
> & {
  selectedNamespace: Namespace['name'];
};

export const useNamespaceSelectorWrapper = (): UseNamespaceSelectorWrapperReturn => {
  const { preferredNamespace, ...rest } = useNamespaceSelector({
    storageKey: 'kubeflow.notebooks.namespace.lastUsed',
    storeLastNamespace: true,
  });

  return {
    ...rest,
    selectedNamespace: preferredNamespace?.name ?? '',
  };
};
