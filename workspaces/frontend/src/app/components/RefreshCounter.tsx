import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { Content, ContentVariants } from '@patternfly/react-core/dist/esm/components/Content';
import { RedoIcon } from '@patternfly/react-icons/dist/esm/icons/redo-icon';

interface RefreshCounterProps {
  interval: number;
  onRefresh: () => void;
  /** Called only for an explicit, user-initiated refresh (the button), not the automatic countdown tick. */
  onManualRefresh?: () => void;
}

export const RefreshCounter: React.FC<RefreshCounterProps> = ({
  interval,
  onRefresh,
  onManualRefresh,
}) => {
  const pollIntervalSeconds = Math.max(1, Math.floor(interval / 1000));
  const [secondsRemaining, setSecondsRemaining] = useState(pollIntervalSeconds);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  // The countdown updater must stay pure — React may invoke a functional setState updater more
  // than once while reconciling a queue (e.g. right after a manual reset), so a side effect
  // (calling onRefresh) does not belong in here. It only decrements, using 0 as a sentinel for
  // "a full cycle just completed," handled by the effect below instead.
  useEffect(() => {
    const countdown = setInterval(() => {
      setSecondsRemaining((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(countdown);
  }, [pollIntervalSeconds]);

  useEffect(() => {
    if (secondsRemaining === 0) {
      onRefreshRef.current();
      setSecondsRemaining(pollIntervalSeconds);
    }
  }, [secondsRemaining, pollIntervalSeconds]);

  const handleManualRefresh = useCallback(() => {
    onRefresh();
    onManualRefresh?.();
    setSecondsRemaining(pollIntervalSeconds);
  }, [onRefresh, onManualRefresh, pollIntervalSeconds]);

  return (
    <Flex spaceItems={{ default: 'spaceItemsSm' }} alignItems={{ default: 'alignItemsCenter' }}>
      <FlexItem>
        <Button
          variant="link"
          onClick={handleManualRefresh}
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
