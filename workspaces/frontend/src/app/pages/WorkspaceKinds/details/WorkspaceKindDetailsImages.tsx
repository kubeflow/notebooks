import React from 'react';
import { WorkspaceKind } from '~/shared/api/backendApiTypes';
import { WorkspaceCountPerKind } from '~/app/hooks/useWorkspaceCountPerKind';
import { WorkspaceKindDetailsTable } from './WorkspaceKindDetailsTable';

type WorkspaceDetailsImagesProps = {
  workspaceKind: WorkspaceKind;
  workspaceCountPerKind: WorkspaceCountPerKind;
};

export const WorkspaceKindDetailsImages: React.FunctionComponent<WorkspaceDetailsImagesProps> = ({
  workspaceKind,
  workspaceCountPerKind,
}) => (
  <WorkspaceKindDetailsTable
    rows={workspaceKind.podTemplate.options.imageConfig.values.map((image) => ({
      id: image.id,
      displayName: image.displayName,
      kindName: workspaceKind.name,
      workspaceCountRouteState: {
        imageId: image.id,
      },
      workspaceCount:
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        workspaceCountPerKind[workspaceKind.name]
          ? workspaceCountPerKind[workspaceKind.name].countByImage[image.id] ?? 0
          : 0,
    }))}
    tableKind="image"
  />
);
