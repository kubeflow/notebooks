import React from 'react';
import { List, ListItem } from '@patternfly/react-core';
import { WorkspaceKind } from '~/shared/api/backendApiTypes';
import { WorkspaceCountPerKind } from '~/app/hooks/useWorkspaceCountPerKind';

type WorkspaceDetailsImagesProps = {
  workspaceKind: WorkspaceKind;
  workspaceCountPerKind: WorkspaceCountPerKind;
};

export const WorkspaceKindDetailsImages: React.FunctionComponent<WorkspaceDetailsImagesProps> = ({
  workspaceKind,
  workspaceCountPerKind,
}) => (
  <List isPlain>
    {workspaceKind.podTemplate.options.imageConfig.values.map((image, rowIndex) => (
      <ListItem key={rowIndex}>
        {image.displayName}: {workspaceCountPerKind[workspaceKind.name].countByImage[image.id] ?? 0}
        {' Workspaces'}
      </ListItem>
    ))}
  </List>
);
