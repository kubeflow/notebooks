import { useCallback } from 'react';
import useFetchState, {
  FetchState,
  FetchStateCallbackPromise,
} from '~/shared/utilities/useFetchState';
import { WorkspaceKind } from '~/shared/api/backendApiTypes';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';

const useWorkspaceKinds = (): FetchState<WorkspaceKind[]> => {
  const { api, apiAvailable } = useNotebookAPI();
  const call = useCallback<FetchStateCallbackPromise<WorkspaceKind[]>>(
    (opts) => {
      if (!apiAvailable) {
        return Promise.reject(new Error('API not yet available'));
      }
      return api.listWorkspaceKinds(opts);
    },
    [api, apiAvailable],
  );

  return useFetchState(call, []);
};

export default useWorkspaceKinds;
