import React from 'react';
import { List, ListItem } from '@patternfly/react-core';
import { WorkspaceKind } from '~/shared/api/backendApiTypes';
import { WorkspaceCountPerKind } from '~/app/hooks/useWorkspaceCountPerKind';

type WorkspaceDetailsNamespacesProps = {
  workspaceKind: WorkspaceKind;
  workspaceCountPerKind: WorkspaceCountPerKind;
};

export const WorkspaceKindDetailsNamespaces: React.FunctionComponent<
  WorkspaceDetailsNamespacesProps
> = ({ workspaceKind, workspaceCountPerKind }) => (
  <List isPlain>
    {Object.keys(
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      workspaceCountPerKind[workspaceKind.name]
        ? workspaceCountPerKind[workspaceKind.name].countByNamespace
        : [],
    ).map((namespace, rowIndex) => (
      <ListItem key={rowIndex}>
        {namespace}:{' '}
        {
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          workspaceCountPerKind[workspaceKind.name]
            ? workspaceCountPerKind[workspaceKind.name].countByNamespace[namespace]
            : 0
        }
        {' Workspaces'}
      </ListItem>
    ))}
  </List>
);
