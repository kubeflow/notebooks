import { useCallback, useMemo } from 'react';
import { FetchStateCallbackPromise, useFetchState, NotReadyError } from 'mod-arch-core';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import {
  MetricsContainerResourceUsage,
  MetricsWorkspaceResourceUsage,
} from '~/generated/data-contracts';

export type WorkspaceResourceUsageState = {
  resourceUsage: MetricsWorkspaceResourceUsage | null;
  containerNames: string[];
  containers: Record<string, MetricsContainerResourceUsage>;
  loaded: boolean;
  error?: Error;
};

export const useWorkspaceResourceUsage = (
  namespace: string | undefined,
  name: string | undefined,
): WorkspaceResourceUsageState => {
  const { api, apiAvailable } = useNotebookAPI();

  const call = useCallback<
    FetchStateCallbackPromise<MetricsWorkspaceResourceUsage | null>
  >(async () => {
    if (!apiAvailable) {
      return Promise.reject(new Error('API not yet available'));
    }
    if (!namespace || !name) {
      return Promise.reject(new NotReadyError('Workspace not yet selected'));
    }
    const response = await api.workspaces.getWorkspacePodTemplateResources(namespace, name);
    return response.data;
  }, [api.workspaces, apiAvailable, namespace, name]);

  const [resourceUsage, loaded, error] = useFetchState(call, null);

  const containers = useMemo(() => resourceUsage?.containers ?? {}, [resourceUsage?.containers]);

  const containerNames = useMemo(() => Object.keys(containers), [containers]);

  return { resourceUsage, containerNames, containers, loaded, error };
};
