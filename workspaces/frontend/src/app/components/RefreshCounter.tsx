import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { Content, ContentVariants } from '@patternfly/react-core/dist/esm/components/Content';
import { RedoIcon } from '@patternfly/react-icons/dist/esm/icons/redo-icon';

interface RefreshCounterProps {
  interval: number;
  onRefresh: () => void | Promise<unknown>;
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
  const [timerCycle, setTimerCycle] = useState(0);
  const [isManualRefreshPending, setIsManualRefreshPending] = useState(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    const countdown = setInterval(() => setSecondsRemaining((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(countdown);
  }, [pollIntervalSeconds, timerCycle]);

  useEffect(() => {
    if (secondsRemaining !== 0 || isManualRefreshPending) {
      return;
    }

    let isCurrentRefresh = true;
    const resetCountdown = () => {
      if (isCurrentRefresh) {
        setSecondsRemaining(pollIntervalSeconds);
        setTimerCycle((cycle) => cycle + 1);
      }
    };
    const refresh = onRefreshRef.current();
    if (refresh && typeof refresh.then === 'function') {
      void refresh.then(resetCountdown, resetCountdown);
    } else {
      resetCountdown();
    }
    return () => {
      isCurrentRefresh = false;
    };
  }, [secondsRemaining, pollIntervalSeconds, isManualRefreshPending]);

  const handleManualRefresh = useCallback(() => {
    setIsManualRefreshPending(true);
    setSecondsRemaining(0);
    onManualRefresh?.();
    const resetCountdown = () => {
      setSecondsRemaining(pollIntervalSeconds);
      setTimerCycle((cycle) => cycle + 1);
      setIsManualRefreshPending(false);
    };
    const refresh = onRefresh();
    if (refresh && typeof refresh.then === 'function') {
      void refresh.then(resetCountdown, resetCountdown);
    } else {
      resetCountdown();
    }
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
          {secondsRemaining === 0
            ? 'Refreshing...'
            : `Refreshing in ${secondsRemaining} seconds...`}
        </Content>
      </FlexItem>
    </Flex>
  );
};
