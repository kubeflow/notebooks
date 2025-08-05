import { useCallback } from 'react';
import useFetchState, {
  FetchState,
  FetchStateCallbackPromise,
} from '~/shared/utilities/useFetchState';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import {
  ApiWorkspaceKindListEnvelope,
  WorkspacekindsWorkspaceKind,
} from '~/generated/data-contracts';

const useWorkspaceKinds = (): FetchState<WorkspacekindsWorkspaceKind[]> => {
  const { api, apiAvailable } = useNotebookAPI();
  const call = useCallback<
    FetchStateCallbackPromise<ApiWorkspaceKindListEnvelope['data']>
  >(async () => {
    if (!apiAvailable) {
      return Promise.reject(new Error('API not yet available'));
    }
    const envelope = await api.workspaceKinds.listWorkspaceKinds();
    return envelope.data;
  }, [api, apiAvailable]);

  return useFetchState(call, []);
};

export default useWorkspaceKinds;
