import * as React from 'react';
import useFetchState, {
  FetchState,
  FetchStateCallbackPromise,
} from '~/shared/utilities/useFetchState';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { WorkspaceKind } from '~/shared/api/backendApiTypes';

const useWorkspaceKindByName = (kind: string): FetchState<WorkspaceKind | null> => {
  const { api, apiAvailable } = useNotebookAPI();

  const call = React.useCallback<FetchStateCallbackPromise<WorkspaceKind | null>>(
    (opts) => {
      if (!apiAvailable) {
        return Promise.reject(new Error('API not yet available'));
      }

      return api.getWorkspaceKind(opts, kind);
    },
    [api, apiAvailable, kind],
  );

  return useFetchState(call, null);
};

export default useWorkspaceKindByName;
