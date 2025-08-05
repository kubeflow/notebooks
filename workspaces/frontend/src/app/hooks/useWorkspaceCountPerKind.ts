import { useEffect, useState } from 'react';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { WorkspaceCountPerOption } from '~/app/types';
import { WorkspacekindsWorkspaceKind, WorkspacesWorkspace } from '~/generated/data-contracts';
import { NotebookApis } from '~/shared/api/notebookApi';

export type WorkspaceCountPerKind = Record<
  WorkspacekindsWorkspaceKind['name'],
  WorkspaceCountPerOption
>;

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

async function loadWorkspaceCounts(api: NotebookApis): Promise<WorkspaceCountPerKind> {
  const [workspaces, workspaceKinds] = await Promise.all([
    api.workspaces.listAllWorkspaces({}),
    api.workspaceKinds.listWorkspaceKinds({}),
  ]);

  return extractCountPerKind({ workspaceKinds: workspaceKinds.data, workspaces: workspaces.data });
}

function extractCountByNamespace(args: {
  kind: WorkspacekindsWorkspaceKind;
  workspaces: WorkspacesWorkspace[];
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
  workspaceKind: WorkspacekindsWorkspaceKind,
): WorkspaceCountPerOption['countByImage'] {
  return workspaceKind.podTemplate.options.imageConfig.values.reduce<
    WorkspaceCountPerOption['countByImage']
  >((acc, { id, clusterMetrics }) => {
    acc[id] = clusterMetrics?.workspacesCount ?? 0;
    return acc;
  }, {});
}

function extractCountByPodConfig(
  workspaceKind: WorkspacekindsWorkspaceKind,
): WorkspaceCountPerOption['countByPodConfig'] {
  return workspaceKind.podTemplate.options.podConfig.values.reduce<
    WorkspaceCountPerOption['countByPodConfig']
  >((acc, { id, clusterMetrics }) => {
    acc[id] = clusterMetrics?.workspacesCount ?? 0;
    return acc;
  }, {});
}

function extractTotalCount(workspaceKind: WorkspacekindsWorkspaceKind): number {
  return workspaceKind.clusterMetrics?.workspacesCount ?? 0;
}

function extractCountPerKind(args: {
  workspaceKinds: WorkspacekindsWorkspaceKind[];
  workspaces: WorkspacesWorkspace[];
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
