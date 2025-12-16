import React from 'react';
import { WorkspaceCountResult } from '~/app/hooks/useWorkspaceCountPerKind';
import { WorkspacekindsWorkspaceKind } from '~/generated/data-contracts';
import { WorkspaceKindDetailsTable } from './WorkspaceKindDetailsTable';

type WorkspaceDetailsPodConfigsProps = {
  workspaceKind: WorkspacekindsWorkspaceKind;
  workspaceCountResult: WorkspaceCountResult;
};

export const WorkspaceKindDetailsPodConfigs: React.FunctionComponent<
  WorkspaceDetailsPodConfigsProps
> = ({ workspaceKind, workspaceCountResult }) => (
  <WorkspaceKindDetailsTable
    rows={workspaceKind.podTemplate.options.podConfig.values.map((podConfig) => ({
      id: podConfig.id,
      displayName: podConfig.displayName,
      kindName: workspaceKind.name,
      workspaceCount:
        workspaceCountResult.workspaceCountPerKind[workspaceKind.name]?.countByPodConfig[
          podConfig.id
        ] ?? 0,
      workspaceCountRouteState: {
        podConfigId: podConfig.id,
      },
    }))}
    tableKind="podConfig"
    workspaceCountError={workspaceCountResult.error}
  />
);
