import * as React from 'react';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { Workspace, WorkspaceKind } from '~/shared/api/backendApiTypes';
import { WorkspaceCountPerOption } from '~/app/types';

export type WorkspaceCountPerKind = Record<WorkspaceKind['name'], WorkspaceCountPerOption>;

export const useWorkspaceCountPerKind = (): WorkspaceCountPerKind => {
  const { api } = useNotebookAPI();

  const [workspaceCountPerKind, setWorkspaceCountPerKind] = React.useState<WorkspaceCountPerKind>(
    {},
  );

  React.useEffect(() => {
    api.listAllWorkspaces({}).then((workspaces) => {
      const countPerKind = workspaces.reduce((acc: WorkspaceCountPerKind, workspace: Workspace) => {
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
      }, {});
      setWorkspaceCountPerKind(countPerKind);
    });
  }, [api]);

  return workspaceCountPerKind;
};
