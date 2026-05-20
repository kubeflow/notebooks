import { useCallback } from 'react';
import { FetchState, FetchStateCallbackPromise, useFetchState, NotReadyError } from 'mod-arch-core';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import useWorkspaceKinds from '~/app/hooks/useWorkspaceKinds';
import { WorkspaceFormData } from '~/app/types';

export const EMPTY_FORM_DATA: WorkspaceFormData = {
  revision: '',
  kind: undefined,
  imageConfig: undefined,
  podConfig: undefined,
  properties: {
    homeVolume: undefined,
    volumes: [],
    secrets: [],
    workspaceName: '',
  },
};

const useWorkspaceFormData = (args: {
  namespace: string | undefined;
  workspaceName: string | undefined;
  workspaceKindName: string | undefined;
}): FetchState<WorkspaceFormData> => {
  const { namespace, workspaceName, workspaceKindName } = args;
  const { api, apiAvailable } = useNotebookAPI();
  const [workspaceKinds, workspaceKindsLoaded, workspaceKindsError] = useWorkspaceKinds(namespace);

  const call = useCallback<FetchStateCallbackPromise<WorkspaceFormData>>(async () => {
    if (!apiAvailable) {
      throw new Error('API not yet available');
    }

    if (!namespace || !workspaceName || !workspaceKindName) {
      return EMPTY_FORM_DATA;
    }

    if (workspaceKindsError) {
      return Promise.reject(workspaceKindsError);
    }

    if (!workspaceKindsLoaded) {
      return Promise.reject(new NotReadyError('Workspace kinds not yet available'));
    }

    const workspaceEnvelope = await api.workspaces.getWorkspace(namespace, workspaceName);
    const workspaceUpdate = workspaceEnvelope.data;
    const workspaceKind = workspaceKinds.find((k) => k.name === workspaceKindName);
    const { imageConfig, podConfig } = workspaceUpdate.podTemplate.options;

    return {
      revision: workspaceUpdate.revision,
      kind: workspaceKind,
      imageConfig,
      podConfig,
      properties: {
        workspaceName,
        volumes: workspaceUpdate.podTemplate.volumes.data.map((volume) => ({
          ...volume,
          isAttached: true,
        })),
        secrets:
          workspaceUpdate.podTemplate.volumes.secrets?.map((secret) => ({
            ...secret,
            isAttached: true,
          })) ?? [],
        // The update API returns home as a plain string (the PVC name). Reconstruct
        // a minimal volume value so the Home Volume section can display it.
        homeVolume: workspaceUpdate.podTemplate.volumes.home
          ? {
              pvcName: workspaceUpdate.podTemplate.volumes.home,
              mountPath: '',
              readOnly: false,
              isAttached: true,
            }
          : undefined,
      },
    };
  }, [
    api,
    apiAvailable,
    namespace,
    workspaceName,
    workspaceKindName,
    workspaceKinds,
    workspaceKindsLoaded,
    workspaceKindsError,
  ]);

  return useFetchState(call, EMPTY_FORM_DATA);
};

export default useWorkspaceFormData;
