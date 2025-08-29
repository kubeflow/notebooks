import { useCallback } from 'react';
import { FetchState, FetchStateCallbackPromise, useFetchState } from 'mod-arch-core';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { ApiWorkspaceKindEnvelope } from '~/generated/data-contracts';

const useWorkspaceKindByName = (
  kind: string | undefined,
): FetchState<ApiWorkspaceKindEnvelope['data'] | null> => {
  const { api, apiAvailable } = useNotebookAPI();

  const call = useCallback<
    FetchStateCallbackPromise<ApiWorkspaceKindEnvelope['data'] | null>
  >(async () => {
    if (!apiAvailable) {
      return Promise.reject(new Error('API not yet available'));
    }

    if (!kind) {
      return null;
    }

    const envelope = await api.workspaceKinds.getWorkspaceKind(kind);
    return envelope.data;
  }, [api, apiAvailable, kind]);

  return useFetchState(call, null);
};

export default useWorkspaceKindByName;
