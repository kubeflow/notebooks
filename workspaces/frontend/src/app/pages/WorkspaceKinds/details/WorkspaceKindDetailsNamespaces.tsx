import React from 'react';
import { Button, List, ListItem } from '@patternfly/react-core';
import { WorkspaceKind } from '~/shared/api/backendApiTypes';
import { WorkspaceCountPerKind } from '~/app/hooks/useWorkspaceCountPerKind';
import { useTypedNavigate } from '~/app/routerHelper';

type WorkspaceDetailsNamespacesProps = {
  workspaceKind: WorkspaceKind;
  workspaceCountPerKind: WorkspaceCountPerKind;
};

export const WorkspaceKindDetailsNamespaces: React.FunctionComponent<
  WorkspaceDetailsNamespacesProps
> = ({ workspaceKind, workspaceCountPerKind }) => {
  const navigate = useTypedNavigate();

  return (
    <List isPlain>
      {Object.keys(
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        workspaceCountPerKind[workspaceKind.name]
          ? workspaceCountPerKind[workspaceKind.name].countByNamespace
          : [],
      ).map((namespace, rowIndex) => (
        <ListItem key={rowIndex}>
          {namespace}:{' '}
          <Button
            variant="link"
            isInline
            onClick={() =>
              navigate('workspaceKindSummary', {
                params: { kind: workspaceKind.name },
                state: {
                  namespace,
                },
              })
            }
          >
            {
              // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
              workspaceCountPerKind[workspaceKind.name]
                ? workspaceCountPerKind[workspaceKind.name].countByNamespace[namespace]
                : 0
            }
            {' Workspaces'}
          </Button>
        </ListItem>
      ))}
    </List>
  );
};
