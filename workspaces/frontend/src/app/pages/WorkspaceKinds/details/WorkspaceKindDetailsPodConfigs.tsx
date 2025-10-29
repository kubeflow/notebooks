import React from 'react';
import { WorkspaceCountPerKind } from '~/app/hooks/useWorkspaceCountPerKind';
import { WorkspacekindsWorkspaceKind } from '~/generated/data-contracts';
import { WorkspaceKindDetailsTable } from './WorkspaceKindDetailsTable';

type WorkspaceDetailsPodConfigsProps = {
  workspaceKind: WorkspacekindsWorkspaceKind;
  workspaceCountPerKind: WorkspaceCountPerKind;
};

export const WorkspaceKindDetailsPodConfigs: React.FunctionComponent<
  WorkspaceDetailsPodConfigsProps
> = ({ workspaceKind, workspaceCountPerKind }) => (
  <WorkspaceKindDetailsTable
    rows={workspaceKind.podTemplate.options.podConfig.values.map((podConfig) => ({
      id: podConfig.id,
      displayName: podConfig.displayName,
      kindName: workspaceKind.name,
      workspaceCount:
        workspaceCountPerKind[workspaceKind.name]?.countByPodConfig[podConfig.id] ?? 0,
      workspaceCountRouteState: {
        podConfigId: podConfig.id,
      },
    }))}
    tableKind="podConfig"
  />
);
