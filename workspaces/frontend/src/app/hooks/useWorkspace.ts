import * as React from 'react';
import useFetchState, {
  FetchState,
  FetchStateCallbackPromise,
} from '~/shared/utilities/useFetchState';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { Workspace } from '~/shared/api/backendApiTypes';

const useWorkspace = (
  namespace: string | undefined,
  workspaceName: string | undefined,
): FetchState<Workspace | null> => {
  const { api, apiAvailable } = useNotebookAPI();

  const call = React.useCallback<FetchStateCallbackPromise<Workspace | null>>(
    async (opts) => {
      if (!apiAvailable) {
        throw new Error('API not yet available');
      }

      if (!namespace || !workspaceName) {
        return null;
      }

      return api.getWorkspace(opts, namespace, workspaceName);
    },
    [api, apiAvailable, namespace, workspaceName],
  );

  return useFetchState(call, null);
};

export default useWorkspace;
