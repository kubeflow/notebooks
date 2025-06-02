import React from 'react';
import { List, ListItem } from '@patternfly/react-core';
import { WorkspaceKind } from '~/shared/api/backendApiTypes';
import { WorkspaceCountPerKind } from '~/app/hooks/useWorkspaceCountPerKind';

type WorkspaceDetailsPodConfigsProps = {
  workspaceKind: WorkspaceKind;
  workspaceCountPerKind: WorkspaceCountPerKind;
};

export const WorkspaceKindDetailsPodConfigs: React.FunctionComponent<
  WorkspaceDetailsPodConfigsProps
> = ({ workspaceKind, workspaceCountPerKind }) => (
  <List isPlain>
    {workspaceKind.podTemplate.options.podConfig.values.map((podConfig, rowIndex) => (
      <ListItem key={rowIndex}>
        {podConfig.displayName}:{' '}
        {
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          workspaceCountPerKind[workspaceKind.name]
            ? workspaceCountPerKind[workspaceKind.name].countByPodConfig[podConfig.id]
            : 0
        }
        {' Workspaces'}
      </ListItem>
    ))}
  </List>
);
