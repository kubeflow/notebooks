import { useCallback } from 'react';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { ApiNamespaceListEnvelope } from '~/generated/data-contracts';
import useFetchState, {
  FetchState,
  FetchStateCallbackPromise,
} from '~/shared/utilities/useFetchState';

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
