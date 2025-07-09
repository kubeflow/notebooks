import React from 'react';
import { format } from 'date-fns/format';
import {
  DescriptionList,
  DescriptionListTerm,
  DescriptionListGroup,
  DescriptionListDescription,
} from '@patternfly/react-core/dist/esm/components/DescriptionList';
import { Divider } from '@patternfly/react-core/dist/esm/components/Divider';
import { Workspace } from '~/shared/api/backendApiTypes';

const DATE_FORMAT = 'PPpp';

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
          {format(activity.lastActivity, DATE_FORMAT)}
        </DescriptionListDescription>
      </DescriptionListGroup>
      <Divider />
      <DescriptionListGroup>
        <DescriptionListTerm>Last Update</DescriptionListTerm>
        <DescriptionListDescription data-testid="lastUpdate">
          {format(activity.lastUpdate, DATE_FORMAT)}
        </DescriptionListDescription>
      </DescriptionListGroup>
      <Divider />
      <DescriptionListGroup>
        <DescriptionListTerm>Pause Time</DescriptionListTerm>
        <DescriptionListDescription data-testid="pauseTime">
          {format(pausedTime, DATE_FORMAT)}
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
