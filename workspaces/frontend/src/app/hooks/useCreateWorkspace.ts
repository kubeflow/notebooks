import * as React from 'react';
import useFetchState, {
  FetchState,
  FetchStateCallbackPromise,
} from '~/shared/utilities/useFetchState';
import { CreateWorkspaceData } from '~/app/types';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { Workspace } from '~/shared/types';
import { createWorkspaceCall } from '~/app/pages/Workspaces/utils';
import { APIOptions } from '~/shared/api/types';

const useCreateWorkspace = (
  namespace: string,
  formData: CreateWorkspaceData,
): FetchState<Workspace | null> => {
  const { api, apiAvailable } = useNotebookAPI();

  const call = React.useCallback<FetchStateCallbackPromise<Workspace | null>>(
    (opts: APIOptions) => {
      if (!apiAvailable) {
        return Promise.reject(new Error('API not yet available'));
      }
      if (!namespace) {
        return Promise.reject(new Error('namespace is not available yet'));
      }
      return createWorkspaceCall(opts, api, formData, namespace).then((result) => result.workspace);
    },
    [api, apiAvailable, namespace, formData],
  );

  return useFetchState(call, null);
};

export default useCreateWorkspace;
