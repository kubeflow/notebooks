import React from 'react';
import { WorkspaceCountResult } from '~/app/hooks/useWorkspaceCountPerKind';
import { WorkspacekindsWorkspaceKind } from '~/generated/data-contracts';
import { WorkspaceKindDetailsTable } from './WorkspaceKindDetailsTable';

type WorkspaceDetailsImagesProps = {
  workspaceKind: WorkspacekindsWorkspaceKind;
  workspaceCountResult: WorkspaceCountResult;
};

export const WorkspaceKindDetailsImages: React.FunctionComponent<WorkspaceDetailsImagesProps> = ({
  workspaceKind,
  workspaceCountResult,
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
        workspaceCountResult.workspaceCountPerKind[workspaceKind.name]?.countByImage[image.id] ?? 0,
    }))}
    tableKind="image"
    workspaceCountError={workspaceCountResult.error}
  />
);
