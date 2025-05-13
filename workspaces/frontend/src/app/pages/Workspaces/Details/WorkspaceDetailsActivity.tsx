import React from 'react';
import {
  DescriptionList,
  DescriptionListTerm,
  DescriptionListGroup,
  DescriptionListDescription,
  Divider,
} from '@patternfly/react-core';
import { Workspace } from '~/shared/api/backendApiTypes';
import { formatTimestamp } from '~/shared/utilities/WorkspaceUtils';

type WorkspaceDetailsActivityProps = {
  workspace: Workspace;
};

export const WorkspaceDetailsActivity: React.FunctionComponent<WorkspaceDetailsActivityProps> = ({
  workspace,
}) => {
  const { activity, pausedTime, pendingRestart } = workspace;

  return (
    <DescriptionList isHorizontal>
      <DescriptionListGroup>
        <DescriptionListTerm>Last Activity</DescriptionListTerm>
        <DescriptionListDescription data-testid="lastActivity">
          {formatTimestamp(activity.lastActivity)}
        </DescriptionListDescription>
      </DescriptionListGroup>
      <Divider />
      <DescriptionListGroup>
        <DescriptionListTerm>Last Update</DescriptionListTerm>
        <DescriptionListDescription data-testid="lastUpdate">
          {formatTimestamp(activity.lastUpdate)}
        </DescriptionListDescription>
      </DescriptionListGroup>
      <Divider />
      <DescriptionListGroup>
        <DescriptionListTerm>Pause Time</DescriptionListTerm>
        <DescriptionListDescription data-testid="pauseTime">
          {formatTimestamp(pausedTime)}
        </DescriptionListDescription>
      </DescriptionListGroup>
      <Divider />
      <DescriptionListGroup>
        <DescriptionListTerm>Pending Restart</DescriptionListTerm>
        <DescriptionListDescription data-testid="pendingRestart">
          {pendingRestart ? 'Yes' : 'No'}
        </DescriptionListDescription>
      </DescriptionListGroup>
      <Divider />
    </DescriptionList>
  );
};
