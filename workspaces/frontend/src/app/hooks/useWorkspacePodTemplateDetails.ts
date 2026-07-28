import { useCallback } from 'react';
import { FetchState, FetchStateCallbackPromise, useFetchState } from 'mod-arch-core';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { ApiWorkspaceDetailsEnvelope } from '~/generated/data-contracts';

const useWorkspacePodTemplateDetails = (
  namespace?: string,
  name?: string,
): FetchState<ApiWorkspaceDetailsEnvelope['data'] | null> => {
  const { api, apiAvailable } = useNotebookAPI();

  const call = useCallback<
    FetchStateCallbackPromise<ApiWorkspaceDetailsEnvelope['data'] | null>
  >(async () => {
    if (!apiAvailable) {
      return Promise.reject(new Error('API not yet available'));
    }
    if (!namespace || !name) {
      return null;
    }

    const envelope = await api.workspaces.getWorkspacePodTemplateDetails(namespace, name);
    return envelope.data;
  }, [api, apiAvailable, namespace, name]);

  return useFetchState(call, null);
};

export default useWorkspacePodTemplateDetails;
