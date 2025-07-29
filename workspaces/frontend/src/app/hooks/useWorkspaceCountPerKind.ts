import { useEffect, useState } from 'react';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { Workspace, WorkspaceKind } from '~/shared/api/backendApiTypes';
import { WorkspaceCountPerOption } from '~/app/types';
import { NotebookAPIs } from '~/shared/api/notebookApi';

export type WorkspaceCountPerKind = Record<WorkspaceKind['name'], WorkspaceCountPerOption>;

export const useWorkspaceCountPerKind = (): WorkspaceCountPerKind => {
  const { api } = useNotebookAPI();
  const [workspaceCountPerKind, setWorkspaceCountPerKind] = useState<WorkspaceCountPerKind>({});

  useEffect(() => {
    const fetchAndSetCounts = async () => {
      try {
        const countPerKind = await loadWorkspaceCounts(api);
        setWorkspaceCountPerKind(countPerKind);
      } catch (err) {
        // TODO: alert user about error
        console.error('Failed to fetch workspace counts:', err);
      }
    };

    fetchAndSetCounts();
  }, [api]);

  return workspaceCountPerKind;
};

async function loadWorkspaceCounts(api: NotebookAPIs): Promise<WorkspaceCountPerKind> {
  const [workspaces, workspaceKinds] = await Promise.all([
    api.listAllWorkspaces({}),
    api.listWorkspaceKinds({}),
  ]);

  return extractCountPerKind({ workspaceKinds, workspaces });
}

function extractCountByNamespace(args: {
  kind: WorkspaceKind;
  workspaces: Workspace[];
}): WorkspaceCountPerOption['countByNamespace'] {
  const { kind, workspaces } = args;
  return workspaces.reduce<WorkspaceCountPerOption['countByNamespace']>(
    (acc, { namespace, workspaceKind }) => {
      if (kind.name === workspaceKind.name) {
        acc[namespace] = (acc[namespace] ?? 0) + 1;
      }
      return acc;
    },
    {},
  );
}

function extractCountByImage(
  workspaceKind: WorkspaceKind,
): WorkspaceCountPerOption['countByImage'] {
  return workspaceKind.podTemplate.options.imageConfig.values.reduce<
    WorkspaceCountPerOption['countByImage']
  >((acc, { id, clusterMetrics }) => {
    acc[id] = clusterMetrics?.workspacesCount ?? 0;
    return acc;
  }, {});
}

function extractCountByPodConfig(
  workspaceKind: WorkspaceKind,
): WorkspaceCountPerOption['countByPodConfig'] {
  return workspaceKind.podTemplate.options.podConfig.values.reduce<
    WorkspaceCountPerOption['countByPodConfig']
  >((acc, { id, clusterMetrics }) => {
    acc[id] = clusterMetrics?.workspacesCount ?? 0;
    return acc;
  }, {});
}

function extractTotalCount(workspaceKind: WorkspaceKind): number {
  return workspaceKind.clusterMetrics?.workspacesCount ?? 0;
}

function extractCountPerKind(args: {
  workspaceKinds: WorkspaceKind[];
  workspaces: Workspace[];
}): WorkspaceCountPerKind {
  const { workspaceKinds, workspaces } = args;

  return workspaceKinds.reduce<WorkspaceCountPerKind>((acc, kind) => {
    acc[kind.name] = {
      count: extractTotalCount(kind),
      countByImage: extractCountByImage(kind),
      countByPodConfig: extractCountByPodConfig(kind),
      countByNamespace: extractCountByNamespace({ kind, workspaces }),
    };

    return acc;
  }, {});
}
