import { useEffect, useState } from 'react';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { WorkspaceCountPerOption } from '~/app/types';
import { WorkspacekindsWorkspaceKind, WorkspacesWorkspace } from '~/generated/data-contracts';

export type WorkspaceCountPerKind = Record<
  WorkspacekindsWorkspaceKind['name'],
  WorkspaceCountPerOption
>;

// TODO: This hook is temporary; we should get counts from the API directly
export const useWorkspaceCountPerKind = (): WorkspaceCountPerKind => {
  const { api } = useNotebookAPI();

  const [workspaceCountPerKind, setWorkspaceCountPerKind] = useState<WorkspaceCountPerKind>({});

  useEffect(() => {
    api.workspaces.listAllWorkspaces().then((envelope) => {
      const countPerKind = envelope.data.reduce(
        (acc: WorkspaceCountPerKind, workspace: WorkspacesWorkspace) => {
          acc[workspace.workspaceKind.name] = acc[workspace.workspaceKind.name] ?? {
            count: 0,
            countByImage: {},
            countByPodConfig: {},
            countByNamespace: {},
          };
          acc[workspace.workspaceKind.name].count =
            (acc[workspace.workspaceKind.name].count || 0) + 1;
          acc[workspace.workspaceKind.name].countByImage[
            workspace.podTemplate.options.imageConfig.current.id
          ] =
            (acc[workspace.workspaceKind.name].countByImage[
              workspace.podTemplate.options.imageConfig.current.id
            ] || 0) + 1;
          acc[workspace.workspaceKind.name].countByPodConfig[
            workspace.podTemplate.options.podConfig.current.id
          ] =
            (acc[workspace.workspaceKind.name].countByPodConfig[
              workspace.podTemplate.options.podConfig.current.id
            ] || 0) + 1;
          acc[workspace.workspaceKind.name].countByNamespace[workspace.namespace] =
            (acc[workspace.workspaceKind.name].countByNamespace[workspace.namespace] || 0) + 1;
          return acc;
        },
        {},
      );
      setWorkspaceCountPerKind(countPerKind);
    });
  }, [api]);

  return workspaceCountPerKind;
};
