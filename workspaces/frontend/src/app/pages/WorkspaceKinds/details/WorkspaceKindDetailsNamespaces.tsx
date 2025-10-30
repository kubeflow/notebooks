import React from 'react';
import { WorkspaceCountPerKind } from '~/app/hooks/useWorkspaceCountPerKind';
import { WorkspacekindsWorkspaceKind } from '~/generated/data-contracts';
import { WorkspaceKindDetailsTable } from './WorkspaceKindDetailsTable';

type WorkspaceDetailsNamespacesProps = {
  workspaceKind: WorkspacekindsWorkspaceKind;
  workspaceCountPerKind: WorkspaceCountPerKind;
};

export const WorkspaceKindDetailsNamespaces: React.FunctionComponent<
  WorkspaceDetailsNamespacesProps
> = ({ workspaceKind, workspaceCountPerKind }) => (
  <WorkspaceKindDetailsTable
    rows={Object.keys(workspaceCountPerKind[workspaceKind.name]?.countByNamespace ?? {}).map(
      (namespace, rowIndex) => ({
        id: String(rowIndex),
        displayName: namespace,
        kindName: workspaceKind.name,
        workspaceCount: workspaceCountPerKind[workspaceKind.name]?.countByNamespace[namespace] ?? 0,
        workspaceCountRouteState: {
          namespace,
        },
      }),
    )}
    tableKind="namespace"
  />
);
