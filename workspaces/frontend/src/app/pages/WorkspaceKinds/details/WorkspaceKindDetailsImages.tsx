import React from 'react';
import {
  OptionsImageConfigValue,
  WorkspacekindsWorkspaceKindListItem,
} from '~/generated/data-contracts';
import { WorkspaceKindDetailsTable } from './WorkspaceKindDetailsTable';

type WorkspaceDetailsImagesProps = {
  workspaceKind: WorkspacekindsWorkspaceKindListItem;
  images: OptionsImageConfigValue[];
};

export const WorkspaceKindDetailsImages: React.FunctionComponent<WorkspaceDetailsImagesProps> = ({
  workspaceKind,
  images,
}) => (
  <WorkspaceKindDetailsTable
    rows={images.map((image) => ({
      id: image.id,
      displayName: image.displayName,
      kindName: workspaceKind.name,
      workspaceCountRouteState: {
        imageId: image.id,
      },
      workspaceCount: image.clusterMetrics?.workspacesCount ?? 0,
    }))}
    tableKind="image"
    workspaceCountError={null}
  />
);
