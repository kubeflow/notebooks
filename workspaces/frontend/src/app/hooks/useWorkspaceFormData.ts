import { useCallback } from 'react';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { WorkspaceFormData } from '~/app/types';
import useFetchState, {
  FetchState,
  FetchStateCallbackPromise,
} from '~/shared/utilities/useFetchState';

export const EMPTY_FORM_DATA: WorkspaceFormData = {
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
}): FetchState<WorkspaceFormData> => {
  const { namespace, workspaceName } = args;
  const { api, apiAvailable } = useNotebookAPI();

  const call = useCallback<FetchStateCallbackPromise<WorkspaceFormData>>(async () => {
    if (!apiAvailable) {
      throw new Error('API not yet available');
    }

    if (!namespace || !workspaceName) {
      return EMPTY_FORM_DATA;
    }

    const workspaceEnvelope = await api.workspaces.getWorkspace(namespace, workspaceName);
    const workspace = workspaceEnvelope.data;
    const workspaceKindEnvelope = await api.workspaceKinds.getWorkspaceKind(
      workspace.workspaceKind.name,
    );
    const workspaceKind = workspaceKindEnvelope.data;
    const imageConfig = workspace.podTemplate.options.imageConfig.current;
    const podConfig = workspace.podTemplate.options.podConfig.current;

    return {
      kind: workspaceKind,
      image: {
        id: imageConfig.id,
        displayName: imageConfig.displayName,
        description: imageConfig.description,
        hidden: false,
        labels: imageConfig.labels,
      },
      podConfig: {
        id: podConfig.id,
        displayName: podConfig.displayName,
        description: podConfig.description,
        hidden: false,
        labels: podConfig.labels,
      },
      properties: {
        workspaceName: workspace.name,
        deferUpdates: workspace.deferUpdates,
        volumes: workspace.podTemplate.volumes.data.map((volume) => ({ ...volume })),
        secrets: workspace.podTemplate.volumes.secrets?.map((secret) => ({ ...secret })) ?? [],
        homeDirectory: workspace.podTemplate.volumes.home?.mountPath ?? '',
      },
    };
  }, [api, apiAvailable, namespace, workspaceName]);

  return useFetchState(call, EMPTY_FORM_DATA);
};

export default useWorkspaceFormData;
