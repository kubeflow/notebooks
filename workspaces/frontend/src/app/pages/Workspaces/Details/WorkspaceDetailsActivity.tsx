import React from 'react';
import {
  DescriptionList,
  DescriptionListTerm,
  DescriptionListGroup,
  DescriptionListDescription,
  Divider,
} from '@patternfly/react-core';
import { Workspace } from '~/shared/types';

type WorkspaceDetailsActivityProps = {
  workspace: Workspace;
};

// Helper function to format UNIX timestamps
const formatTimestamp = (timestamp: number): string => {
  if (!timestamp || timestamp === 0) {
    return '-'; // Return a dash if timestamp is not set
  }
  const date = new Date(timestamp * 1000); // Convert to milliseconds
  return date.toLocaleString(); // Format as a readable string
};

// Reusable component for Description List Group
const DescriptionItem: React.FC<{ term: string; value: string | boolean; testid: string }> = ({ term, value, testid }) => (
  <DescriptionListGroup>
    <DescriptionListTerm>{term}</DescriptionListTerm>
    <DescriptionListDescription data-testid={testid}>{value}</DescriptionListDescription>
  </DescriptionListGroup>
);

export const WorkspaceDetailsActivity: React.FunctionComponent<WorkspaceDetailsActivityProps> = ({
  workspace,
}) => (
  <DescriptionList isHorizontal>
    <DescriptionItem
      term="Last Activity"
      value={formatTimestamp(workspace.status.activity.lastActivity)}
      testid="lastActivity"
    />
    <Divider />
    <DescriptionItem
      term="Last Update"
      value={formatTimestamp(workspace.status.activity.lastUpdate)}
      testid="lastUpdate"
    />
    <Divider />
    <DescriptionItem term="Pause Time" value={formatTimestamp(workspace.status.pauseTime)} testid='PauseTime' />
    <Divider />
    <DescriptionItem
      term="Pending Restart"
      value={workspace.status.pendingRestart ? 'Yes' : 'No'}
      testid='PendingRestart'
    />
    <Divider />
  </DescriptionList>
);
