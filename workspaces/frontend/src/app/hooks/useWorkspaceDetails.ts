import { useCallback } from 'react';
import { FetchState, FetchStateCallbackPromise, useFetchState, NotReadyError } from 'mod-arch-core';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { DetailsWorkspaceDetails } from '~/generated/data-contracts';

export const useWorkspaceDetails = (
  namespace: string | undefined,
  name: string | undefined,
): FetchState<DetailsWorkspaceDetails | null> => {
  const { api, apiAvailable } = useNotebookAPI();

  const call = useCallback<FetchStateCallbackPromise<DetailsWorkspaceDetails | null>>(async () => {
    if (!apiAvailable) {
      return Promise.reject(new Error('API not yet available'));
    }
    if (!namespace || !name) {
      return Promise.reject(new NotReadyError('Workspace not yet selected'));
    }
    const response = await api.workspaces.getWorkspacePodTemplateDetails(namespace, name);
    return response.data;
  }, [api.workspaces, apiAvailable, namespace, name]);

  return useFetchState(call, null);
};
