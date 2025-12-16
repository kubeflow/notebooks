import React from 'react';
import { WorkspaceCountResult } from '~/app/hooks/useWorkspaceCountPerKind';
import { WorkspacekindsWorkspaceKind } from '~/generated/data-contracts';
import { WorkspaceKindDetailsTable } from './WorkspaceKindDetailsTable';

type WorkspaceDetailsNamespacesProps = {
  workspaceKind: WorkspacekindsWorkspaceKind;
  workspaceCountResult: WorkspaceCountResult;
};

export const WorkspaceKindDetailsNamespaces: React.FunctionComponent<
  WorkspaceDetailsNamespacesProps
> = ({ workspaceKind, workspaceCountResult }) => (
  <WorkspaceKindDetailsTable
    rows={Object.keys(
      workspaceCountResult.workspaceCountPerKind[workspaceKind.name]?.countByNamespace ?? {},
    ).map((namespace, rowIndex) => ({
      id: String(rowIndex),
      displayName: namespace,
      kindName: workspaceKind.name,
      workspaceCount:
        workspaceCountResult.workspaceCountPerKind[workspaceKind.name]?.countByNamespace[
          namespace
        ] ?? 0,
      workspaceCountRouteState: {
        namespace,
      },
    }))}
    tableKind="namespace"
    workspaceCountError={workspaceCountResult.error}
  />
);
