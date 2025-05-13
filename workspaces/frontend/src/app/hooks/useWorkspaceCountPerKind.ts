import * as React from 'react';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { Workspace, WorkspaceKind } from '~/shared/api/backendApiTypes';

type WorkspaceCountPerKind = Record<WorkspaceKind['name'], number>;

export const useWorkspaceCountPerKind = (): WorkspaceCountPerKind => {
  const { api } = useNotebookAPI();

  const [workspaceCountPerKind, setWorkspaceCountPerKind] = React.useState<WorkspaceCountPerKind>(
    {},
  );

  React.useEffect(() => {
    api.listAllWorkspaces({}).then((workspaces) => {
      const countPerKind = workspaces.reduce((acc: WorkspaceCountPerKind, workspace: Workspace) => {
        acc[workspace.workspaceKind.name] = (acc[workspace.workspaceKind.name] || 0) + 1;
        return acc;
      }, {});
      setWorkspaceCountPerKind(countPerKind);
    });
  }, [api]);

  return workspaceCountPerKind;
};
