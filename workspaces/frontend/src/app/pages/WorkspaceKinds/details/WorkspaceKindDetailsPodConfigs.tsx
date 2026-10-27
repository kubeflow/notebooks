import React from 'react';
import {
  OptionsPodConfigValue,
  WorkspacekindsWorkspaceKindListItem,
} from '~/generated/data-contracts';
import { WorkspaceKindDetailsTable } from './WorkspaceKindDetailsTable';

type WorkspaceDetailsPodConfigsProps = {
  workspaceKind: WorkspacekindsWorkspaceKindListItem;
  podConfigs: OptionsPodConfigValue[];
};

export const WorkspaceKindDetailsPodConfigs: React.FunctionComponent<
  WorkspaceDetailsPodConfigsProps
> = ({ workspaceKind, podConfigs }) => (
  <WorkspaceKindDetailsTable
    rows={podConfigs.map((podConfig) => ({
      id: podConfig.id,
      displayName: podConfig.displayName,
      kindName: workspaceKind.name,
      workspaceCount: podConfig.clusterMetrics?.workspacesCount ?? 0,
      workspaceCountRouteState: {
        podConfigId: podConfig.id,
      },
    }))}
    tableKind="podConfig"
    workspaceCountError={null}
  />
);
