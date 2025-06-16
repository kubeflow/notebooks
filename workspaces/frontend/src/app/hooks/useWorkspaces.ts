import { useCallback } from 'react';
import useFetchState, {
  FetchState,
  FetchStateCallbackPromise,
} from '~/shared/utilities/useFetchState';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { Workspace } from '~/shared/api/backendApiTypes';

const useWorkspaces = (namespace: string): FetchState<Workspace[] | null> => {
  const { api, apiAvailable } = useNotebookAPI();

  const call = useCallback<FetchStateCallbackPromise<Workspace[] | null>>(
    (opts) => {
      if (!apiAvailable) {
        return Promise.reject(new Error('API not yet available'));
      }

      return api.listWorkspaces(opts, namespace);
    },
    [api, apiAvailable, namespace],
  );

  return useFetchState(call, null);
};

export default useWorkspaces;
