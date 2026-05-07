import { useEffect, useState } from 'react';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { WorkspaceCountPerOption } from '~/app/types';
import {
  ApiErrorEnvelope,
  WorkspacekindsWorkspaceKindListItem,
  WorkspacesWorkspaceListItem,
} from '~/generated/data-contracts';
import { NotebookApis } from '~/shared/api/notebookApi';
import { extractErrorMessage } from '~/shared/api/apiUtils';

export type WorkspaceCountPerKind = Partial<
  Record<WorkspacekindsWorkspaceKindListItem['name'], WorkspaceCountPerOption>
>;

export type WorkspaceCountResult = {
  workspaceCountPerKind: WorkspaceCountPerKind;
  error: string | ApiErrorEnvelope | null;
};

export const useWorkspaceCountPerKind = (): WorkspaceCountResult => {
  const { api } = useNotebookAPI();
  const [workspaceCountPerKind, setWorkspaceCountPerKind] = useState<WorkspaceCountPerKind>({});
  const [error, setError] = useState<string | ApiErrorEnvelope | null>(null);

  useEffect(() => {
    const fetchAndSetCounts = async () => {
      try {
        const countPerKind = await loadWorkspaceCounts(api);
        setWorkspaceCountPerKind(countPerKind);
        setError(null);
      } catch (err) {
        setError(extractErrorMessage(err));
      }
    };

    fetchAndSetCounts();
  }, [api]);

  return { workspaceCountPerKind, error };
};

async function loadWorkspaceCounts(api: NotebookApis): Promise<WorkspaceCountPerKind> {
  const [workspaces, workspaceKinds] = await Promise.all([
    api.workspaces.listAllWorkspaces({}),
    api.workspaceKinds.listWorkspaceKinds({}),
  ]);

  return extractCountPerKind({ workspaceKinds: workspaceKinds.data, workspaces: workspaces.data });
}

function extractCountByNamespace(args: {
  kind: WorkspacekindsWorkspaceKindListItem;
  workspaces: WorkspacesWorkspaceListItem[];
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
  workspaceKind: WorkspacekindsWorkspaceKindListItem,
): WorkspaceCountPerOption['countByImage'] {
  return (workspaceKind.podTemplate.options.imageConfig.values ?? []).reduce<
    WorkspaceCountPerOption['countByImage']
  >((acc, { id, clusterMetrics }) => {
    acc[id] = clusterMetrics?.workspacesCount ?? 0;
    return acc;
  }, {});
}

function extractCountByPodConfig(
  workspaceKind: WorkspacekindsWorkspaceKindListItem,
): WorkspaceCountPerOption['countByPodConfig'] {
  return (workspaceKind.podTemplate.options.podConfig.values ?? []).reduce<
    WorkspaceCountPerOption['countByPodConfig']
  >((acc, { id, clusterMetrics }) => {
    acc[id] = clusterMetrics?.workspacesCount ?? 0;
    return acc;
  }, {});
}

function extractTotalCount(workspaceKind: WorkspacekindsWorkspaceKindListItem): number {
  return workspaceKind.clusterMetrics.workspacesCount;
}

function extractCountPerKind(args: {
  workspaceKinds: WorkspacekindsWorkspaceKindListItem[];
  workspaces: WorkspacesWorkspaceListItem[];
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
