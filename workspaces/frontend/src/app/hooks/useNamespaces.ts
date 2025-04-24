import * as React from 'react';
import useFetchState, {
  FetchState,
  FetchStateCallbackPromise,
} from '~/shared/utilities/useFetchState';
import { NamespacesList } from '~/app/types';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';

const useNamespaces = (): FetchState<NamespacesList | null> => {
  const { api, apiAvailable } = useNotebookAPI();

  const call = React.useCallback<FetchStateCallbackPromise<NamespacesList | null>>(
    (opts) => {
      if (!apiAvailable) {
        return Promise.reject(new Error('API not yet available'));
      }

      return api.getNamespaces(opts);
    },
    [api, apiAvailable],
  );

  return useFetchState(call, null);
};

export default useNamespaces;
