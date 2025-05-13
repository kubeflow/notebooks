import * as React from 'react';
import useFetchState, {
  FetchState,
  FetchStateCallbackPromise,
} from '~/shared/utilities/useFetchState';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { Namespace } from '~/shared/api/backendApiTypes';

const useNamespaces = (): FetchState<Namespace[] | null> => {
  const { api, apiAvailable } = useNotebookAPI();

  const call = React.useCallback<FetchStateCallbackPromise<Namespace[] | null>>(
    (opts) => {
      if (!apiAvailable) {
        return Promise.reject(new Error('API not yet available'));
      }

      return api.listNamespaces(opts);
    },
    [api, apiAvailable],
  );

  return useFetchState(call, null);
};

export default useNamespaces;
