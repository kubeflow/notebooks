import React, { useCallback, useEffect, useState } from 'react';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { Content, ContentVariants } from '@patternfly/react-core/dist/esm/components/Content';
import { RedoIcon } from '@patternfly/react-icons/dist/esm/icons/redo-icon';

interface RefreshCounterProps {
  interval: number;
  onRefresh: () => void;
}

export const RefreshCounter: React.FC<RefreshCounterProps> = ({ interval, onRefresh }) => {
  const pollIntervalSeconds = Math.max(1, Math.floor(interval / 1000));
  const [secondsRemaining, setSecondsRemaining] = useState(pollIntervalSeconds);

  const handleRefresh = useCallback(() => {
    onRefresh();
    setSecondsRemaining(pollIntervalSeconds);
  }, [onRefresh, pollIntervalSeconds]);

  useEffect(() => {
    const countdown = setInterval(
      () =>
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            handleRefresh();
            return pollIntervalSeconds;
          }
          return prev - 1;
        }),
      1000,
    );
    return () => clearInterval(countdown);
  }, [pollIntervalSeconds, handleRefresh]);

  return (
    <Flex spaceItems={{ default: 'spaceItemsSm' }} alignItems={{ default: 'alignItemsCenter' }}>
      <FlexItem>
        <Button
          variant="link"
          onClick={handleRefresh}
          data-testid="workspace-refresh-now"
          aria-label="Refresh"
        >
          <RedoIcon />
        </Button>
      </FlexItem>
      <FlexItem>
        <Content
          component={ContentVariants.small}
          style={{
            fontStyle: 'italic',
            color: 'var(--pf-t--global--icon--color--subtle)',
          }}
          data-testid="workspace-refresh-countdown"
          aria-live="polite"
        >
          Refreshing in {secondsRemaining} seconds...
        </Content>
      </FlexItem>
    </Flex>
  );
};
