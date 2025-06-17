import { useCallback } from 'react';
import useFetchState, {
  FetchState,
  FetchStateCallbackPromise,
} from '~/shared/utilities/useFetchState';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { Workspace } from '~/shared/api/backendApiTypes';

export const useWorkspacesByNamespace = (namespace: string): FetchState<Workspace[]> => {
  const { api, apiAvailable } = useNotebookAPI();

  const call = useCallback<FetchStateCallbackPromise<Workspace[]>>(
    (opts) => {
      if (!apiAvailable) {
        return Promise.reject(new Error('API not yet available'));
      }

      return api.listWorkspaces(opts, namespace);
    },
    [api, apiAvailable, namespace],
  );

  return useFetchState(call, []);
};

export const useWorkspacesByKind = (args: {
  kind: string;
  namespace?: string;
  imageId?: string;
  podConfigId?: string;
}): FetchState<Workspace[]> => {
  const { kind, namespace, imageId, podConfigId } = args;
  const { api, apiAvailable } = useNotebookAPI();
  const call = useCallback<FetchStateCallbackPromise<Workspace[]>>(
    async (opts) => {
      if (!apiAvailable) {
        throw new Error('API not yet available');
      }
      if (!kind) {
        throw new Error('Workspace kind is required');
      }

      const workspaces = await api.listAllWorkspaces(opts);

      return workspaces.filter((workspace) => {
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
    },
    [apiAvailable, api, kind, namespace, imageId, podConfigId],
  );
  return useFetchState(call, []);
};
