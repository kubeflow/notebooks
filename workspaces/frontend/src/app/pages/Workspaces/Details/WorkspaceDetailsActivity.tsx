import React from 'react';
import { format } from 'date-fns/format';
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow';
import {
  DescriptionList,
  DescriptionListTerm,
  DescriptionListGroup,
  DescriptionListDescription,
} from '@patternfly/react-core/dist/esm/components/DescriptionList';
import { Divider } from '@patternfly/react-core/dist/esm/components/Divider';
import { Label } from '@patternfly/react-core/dist/esm/components/Label';
import { WorkspacesWorkspaceListItem, V1Beta1WorkspaceState } from '~/generated/data-contracts';
import { getMsUntilCull } from '~/shared/utilities/cullingUtils';

const DATE_FORMAT = 'PPpp';

type WorkspaceDetailsActivityProps = {
  workspace: WorkspacesWorkspaceListItem;
};

const probeResultColor = (result: string): 'green' | 'red' | 'orange' => {
  if (result === 'Success') {
    return 'green';
  }
  if (result === 'Failure') {
    return 'red';
  }
  return 'orange';
};

const formatMsUntilCull = (ms: number): string => {
  if (ms <= 0) {
    return 'imminent';
  }
  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.ceil((totalSeconds % 3600) / 60);
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  return `${minutes}m`;
};

export const WorkspaceDetailsActivity: React.FunctionComponent<WorkspaceDetailsActivityProps> = ({
  workspace,
}) => {
  const { activity, pausedTime, pendingRestart, workspaceKind, state } = workspace;

  const msUntilCull = getMsUntilCull(workspace);
  const isRunning = state === V1Beta1WorkspaceState.WorkspaceStateRunning;
  const hasCulling = workspaceKind.cullingConfig != null;

  return (
    <DescriptionList isHorizontal>
      <DescriptionListGroup>
        <DescriptionListTerm>Last activity</DescriptionListTerm>
        <DescriptionListDescription data-testid="lastActivity">
          {activity.lastActivity === 0
            ? 'unknown'
            : `${format(activity.lastActivity, DATE_FORMAT)} (${formatDistanceToNow(
                new Date(activity.lastActivity),
                { addSuffix: true },
              )})`}
        </DescriptionListDescription>
      </DescriptionListGroup>
      <Divider />
      {isRunning && hasCulling && (
        <>
          <DescriptionListGroup>
            <DescriptionListTerm>Idle duration</DescriptionListTerm>
            <DescriptionListDescription data-testid="idleDuration">
              {activity.lastActivity === 0
                ? 'unknown'
                : formatDistanceToNow(new Date(activity.lastActivity))}
            </DescriptionListDescription>
          </DescriptionListGroup>
          <Divider />
          <DescriptionListGroup>
            <DescriptionListTerm>Auto-pause in</DescriptionListTerm>
            <DescriptionListDescription data-testid="cullingCountdown">
              {msUntilCull === null
                ? 'N/A'
                : msUntilCull <= 0
                  ? 'imminent'
                  : formatMsUntilCull(msUntilCull)}
            </DescriptionListDescription>
          </DescriptionListGroup>
          <Divider />
        </>
      )}
      {activity.lastProbe && (
        <>
          <DescriptionListGroup>
            <DescriptionListTerm>Last probe result</DescriptionListTerm>
            <DescriptionListDescription data-testid="lastProbeResult">
              <Label color={probeResultColor(activity.lastProbe.result)} isCompact>
                {activity.lastProbe.result}
              </Label>
              {activity.lastProbe.message && (
                <span style={{ marginLeft: '0.5rem' }}>{activity.lastProbe.message}</span>
              )}
            </DescriptionListDescription>
          </DescriptionListGroup>
          <Divider />
          <DescriptionListGroup>
            <DescriptionListTerm>Last probe time</DescriptionListTerm>
            <DescriptionListDescription data-testid="lastProbeTime">
              {format(activity.lastProbe.endTimeMs, DATE_FORMAT)}
            </DescriptionListDescription>
          </DescriptionListGroup>
          <Divider />
        </>
      )}
      <DescriptionListGroup>
        <DescriptionListTerm>Last update</DescriptionListTerm>
        <DescriptionListDescription data-testid="lastUpdate">
          {activity.lastUpdate === 0 ? 'unknown' : format(activity.lastUpdate, DATE_FORMAT)}
        </DescriptionListDescription>
      </DescriptionListGroup>
      <Divider />
      <DescriptionListGroup>
        <DescriptionListTerm>Pause time</DescriptionListTerm>
        <DescriptionListDescription data-testid="pauseTime">
          {pausedTime === 0 ? 'unknown' : format(pausedTime, DATE_FORMAT)}
        </DescriptionListDescription>
      </DescriptionListGroup>
      <Divider />
      <DescriptionListGroup>
        <DescriptionListTerm>Pending restart</DescriptionListTerm>
        <DescriptionListDescription data-testid="pendingRestart">
          {pendingRestart ? 'Yes' : 'No'}
        </DescriptionListDescription>
      </DescriptionListGroup>
      <Divider />
    </DescriptionList>
  );
};
