import { useCallback } from 'react';
import { FetchState, FetchStateCallbackPromise, useFetchState } from 'mod-arch-core';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
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

  const call = useCallback<FetchStateCallbackPromise<WorkspaceFormData>>(async () => {
    if (!apiAvailable) {
      throw new Error('API not yet available');
    }

    if (!namespace || !workspaceName || !workspaceKindName) {
      return EMPTY_FORM_DATA;
    }

    const workspaceEnvelope = await api.workspaces.getWorkspace(namespace, workspaceName);
    const workspaceUpdate = workspaceEnvelope.data;
    const workspaceKindEnvelope = await api.workspaceKinds.getWorkspaceKind(workspaceKindName);
    const workspaceKind = workspaceKindEnvelope.data;
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
  }, [api, apiAvailable, namespace, workspaceName, workspaceKindName]);

  return useFetchState(call, EMPTY_FORM_DATA);
};

export default useWorkspaceFormData;
