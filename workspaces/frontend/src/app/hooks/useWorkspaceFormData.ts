import * as React from 'react';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { WorkspaceCreateFormData } from '~/app/types';
import useFetchState, {
  FetchState,
  FetchStateCallbackPromise,
} from '~/shared/utilities/useFetchState';

const EMPTY_FORM_DATA: WorkspaceCreateFormData = {
  kind: undefined,
  image: undefined,
  podConfig: undefined,
  properties: {
    deferUpdates: false,
    homeDirectory: '',
    volumes: [],
    secrets: [],
    workspaceName: '',
  },
};

const useWorkspaceFormData = (args: {
  namespace: string | undefined;
  workspaceName: string | undefined;
}): FetchState<WorkspaceCreateFormData> => {
  const { api, apiAvailable } = useNotebookAPI();

  const call = React.useCallback<FetchStateCallbackPromise<WorkspaceCreateFormData>>(
    async (opts) => {
      if (!apiAvailable) {
        throw new Error('API not yet available');
      }

      if (!args.namespace || !args.workspaceName) {
        return EMPTY_FORM_DATA;
      }

      const workspace = await api.getWorkspace(opts, args.namespace, args.workspaceName);
      const workspaceKind = await api.getWorkspaceKind(opts, workspace.workspaceKind.name);
      const imageConfig = workspace.podTemplate.options.imageConfig.current;
      const podConfig = workspace.podTemplate.options.podConfig.current;

      return {
        kind: workspaceKind,
        image: {
          id: imageConfig.id,
          displayName: imageConfig.displayName,
          description: imageConfig.description,
          hidden: false,
          labels: [],
        },
        podConfig: {
          id: podConfig.id,
          displayName: podConfig.displayName,
          description: podConfig.description,
          hidden: false,
          labels: [],
        },
        properties: {
          workspaceName: workspace.name,
          deferUpdates: workspace.deferUpdates,
          volumes: workspace.podTemplate.volumes.data.map((volume) => ({ ...volume })),
          secrets: workspace.podTemplate.volumes.secrets?.map((secret) => ({ ...secret })) ?? [],
          homeDirectory: workspace.podTemplate.volumes.home?.mountPath ?? '',
        },
      };
    },
    [api, apiAvailable, args.namespace, args.workspaceName],
  );

  return useFetchState(call, EMPTY_FORM_DATA);
};

export default useWorkspaceFormData;
