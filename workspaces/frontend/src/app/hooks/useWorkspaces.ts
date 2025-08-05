import { useCallback } from 'react';
import useFetchState, {
  FetchState,
  FetchStateCallbackPromise,
} from '~/shared/utilities/useFetchState';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { ApiWorkspaceListEnvelope } from '~/generated/data-contracts';

export const useWorkspacesByNamespace = (
  namespace: string,
): FetchState<ApiWorkspaceListEnvelope['data']> => {
  const { api, apiAvailable } = useNotebookAPI();

  const call = useCallback<
    FetchStateCallbackPromise<ApiWorkspaceListEnvelope['data']>
  >(async () => {
    if (!apiAvailable) {
      return Promise.reject(new Error('API not yet available'));
    }

    const envelope = await api.workspaces.listWorkspacesByNamespace(namespace);
    return envelope.data;
  }, [api, apiAvailable, namespace]);

  return useFetchState(call, []);
};

export const useWorkspacesByKind = (args: {
  kind: string;
  namespace?: string;
  imageId?: string;
  podConfigId?: string;
}): FetchState<ApiWorkspaceListEnvelope['data']> => {
  const { kind, namespace, imageId, podConfigId } = args;
  const { api, apiAvailable } = useNotebookAPI();
  const call = useCallback<
    FetchStateCallbackPromise<ApiWorkspaceListEnvelope['data']>
  >(async () => {
    if (!apiAvailable) {
      throw new Error('API not yet available');
    }
    if (!kind) {
      throw new Error('Workspace kind is required');
    }

    const envelope = await api.workspaces.listAllWorkspaces();

    return envelope.data.filter((workspace) => {
      const matchesKind = workspace.workspaceKind.name === kind;
      const matchesNamespace = namespace ? workspace.namespace === namespace : true;
      const matchesImage = imageId
        ? workspace.podTemplate.options.imageConfig.current.id === imageId
        : true;
      const matchesPodConfig = podConfigId
        ? workspace.podTemplate.options.podConfig.current.id === podConfigId
        : true;

      return matchesKind && matchesNamespace && matchesImage && matchesPodConfig;
    });
  }, [apiAvailable, api, kind, namespace, imageId, podConfigId]);
  return useFetchState(call, []);
};
