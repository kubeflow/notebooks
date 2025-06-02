import { useCallback } from 'react';
import useFetchState, {
  FetchState,
  FetchStateCallbackPromise,
} from '~/shared/utilities/useFetchState';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { Workspace } from '~/shared/api/backendApiTypes';

export const useWorkspacesByNamespace = (namespace: string): FetchState<Workspace[] | null> => {
  const { api, apiAvailable } = useNotebookAPI();

  const call = useCallback<FetchStateCallbackPromise<Workspace[] | null>>(
    (opts) => {
      if (!apiAvailable) {
        return Promise.reject(new Error('API not yet available'));
      }

      return api.listWorkspaces(opts, namespace);
    },
    [api, apiAvailable, namespace],
  );

  return useFetchState(call, null);
};

export const useWorkspacesByKind = (args: {
  kind: string;
  imageId?: string;
  podConfigId?: string;
}): FetchState<Workspace[] | null> => {
  const { kind, imageId, podConfigId } = args;
  const { api, apiAvailable } = useNotebookAPI();
  const call = React.useCallback<FetchStateCallbackPromise<Workspace[] | null>>(
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
        const matchesImage = imageId
          ? workspace.podTemplate.options.imageConfig.current.id === imageId
          : true;
        const matchesPodConfig = podConfigId
          ? workspace.podTemplate.options.podConfig.current.id === podConfigId
          : true;
        return matchesKind && matchesImage && matchesPodConfig;
      });
    },
    [apiAvailable, api, kind, imageId, podConfigId],
  );
  return useFetchState(call, null);
};
