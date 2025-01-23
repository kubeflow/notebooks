import * as React from 'react';
import useFetchState, {
  FetchState,
  FetchStateCallbackPromise,
} from '~/shared/utilities/useFetchState';
import { WorkspaceKind } from '~/shared/types';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';

const useWorkspaceKinds = (): FetchState<WorkspaceKind[]> => {
  const { api, apiAvailable } = useNotebookAPI();
  const call = React.useCallback<FetchStateCallbackPromise<WorkspaceKind[]>>(
    (opts) => {
      if (!apiAvailable) {
        return Promise.reject(new Error('API not yet available'));
      }
      return api.getWorkspaceKinds(opts);
    },
    [api, apiAvailable],
  );

  return useFetchState(call, []);
};

export default useWorkspaceKinds;
