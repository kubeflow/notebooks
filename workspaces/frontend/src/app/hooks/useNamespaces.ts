import { useCallback } from 'react';
import { FetchState, FetchStateCallbackPromise, useFetchState } from 'mod-arch-core';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { ApiNamespaceListEnvelope } from '~/generated/data-contracts';

const useNamespaces = (): FetchState<ApiNamespaceListEnvelope['data'] | null> => {
  const { api, apiAvailable } = useNotebookAPI();

  const call = useCallback<
    FetchStateCallbackPromise<ApiNamespaceListEnvelope['data'] | null>
  >(async () => {
    if (!apiAvailable) {
      throw new Error('API not yet available');
    }

    const envelope = await api.namespaces.listNamespaces();
    return envelope.data;
  }, [api, apiAvailable]);

  return useFetchState(call, null);
};

export default useNamespaces;
