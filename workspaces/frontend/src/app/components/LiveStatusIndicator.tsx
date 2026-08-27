import React from 'react';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { Content, ContentVariants } from '@patternfly/react-core/dist/esm/components/Content';
import { Icon } from '@patternfly/react-core/dist/esm/components/Icon';
import { RedoIcon } from '@patternfly/react-icons/dist/esm/icons/redo-icon';
import { CircleIcon } from '@patternfly/react-icons/dist/esm/icons/circle-icon';
import { StreamConnectionStatus } from '~/app/hooks/useWorkspacesLive';

interface LiveStatusIndicatorProps {
  status: StreamConnectionStatus;
  onRefresh: () => void;
}

const STATUS_META: Record<
  StreamConnectionStatus,
  { label: string; color: React.ComponentProps<typeof Icon>['status'] }
> = {
  connecting: { label: 'Connecting…', color: undefined },
  live: { label: 'Live', color: 'success' },
  reconnecting: { label: 'Reconnecting…', color: 'warning' },
  error: { label: 'Disconnected', color: 'danger' },
};

// LiveStatusIndicator shows the Server-Sent Events connection state for the
// workspaces table, plus a manual refresh (reconnect) control. It replaces the
// countdown-based RefreshCounter when the table is in live-streaming mode.
export const LiveStatusIndicator: React.FC<LiveStatusIndicatorProps> = ({ status, onRefresh }) => {
  const { label, color } = STATUS_META[status];

  return (
    <Flex spaceItems={{ default: 'spaceItemsSm' }} alignItems={{ default: 'alignItemsCenter' }}>
      <FlexItem>
        <Button
          variant="link"
          onClick={onRefresh}
          data-testid="workspace-refresh-now"
          aria-label="Refresh"
        >
          <RedoIcon />
        </Button>
      </FlexItem>
      <FlexItem>
        <Icon size="sm" status={color}>
          <CircleIcon />
        </Icon>
      </FlexItem>
      <FlexItem>
        <Content
          component={ContentVariants.small}
          style={{
            fontStyle: 'italic',
            color: 'var(--pf-t--global--icon--color--subtle)',
          }}
          data-testid="workspace-live-status"
          aria-live="polite"
        >
          {label}
        </Content>
      </FlexItem>
    </Flex>
  );
};
