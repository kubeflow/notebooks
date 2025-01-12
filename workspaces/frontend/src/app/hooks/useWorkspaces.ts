import * as React from 'react';
import { Workspace } from '~/shared/types';
import useFetchState, {
  FetchState,
  FetchStateCallbackPromise,
} from '~/shared/utilities/useFetchState';
import { useNotebookAPI } from './useNotebookAPI';

const useWorkspaces = (namespace = ''): FetchState<Workspace[]> => {
  const { api, apiAvailable } = useNotebookAPI();

  const call = React.useCallback<FetchStateCallbackPromise<Workspace[]>>(
    (opts) => {
      if (!apiAvailable) {
        return Promise.reject(new Error('API not yet available'));
      }
      return api.getWorkspaces(opts, namespace);
    },
    [api, apiAvailable, namespace],
  );

  return useFetchState(call, []);
};

export default useWorkspaces;
