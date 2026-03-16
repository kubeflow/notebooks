import React, { useCallback, useRef } from 'react';
import { Popover } from '@patternfly/react-core/dist/esm/components/Popover';
import { Icon } from '@patternfly/react-core/dist/esm/components/Icon';
import { QuestionCircleIcon } from '@patternfly/react-icons/dist/esm/icons/question-circle-icon';

interface HiddenIconWithPopoverProps {
  popoverId: string;
  activePopoverId: string | null;
  pinnedPopoverId: string | null;
  onActiveChange: (id: string | null) => void;
  onPinnedChange: (id: string | null) => void;
}

export const HiddenIconWithPopover: React.FC<HiddenIconWithPopoverProps> = ({
  popoverId,
  activePopoverId,
  pinnedPopoverId,
  onActiveChange,
  onPinnedChange,
}) => {
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isHoveringPopoverRef = useRef(false);

  const clearHideTimeout = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  const handleClick = useCallback(
    (e?: React.MouseEvent) => {
      if (e) {
        e.stopPropagation();
      }
      clearHideTimeout();
      if (pinnedPopoverId === popoverId) {
        onPinnedChange(null);
      } else {
        onPinnedChange(popoverId);
        onActiveChange(null);
      }
    },
    [pinnedPopoverId, popoverId, onPinnedChange, onActiveChange, clearHideTimeout],
  );

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      clearHideTimeout();
      if (pinnedPopoverId !== popoverId) {
        onActiveChange(popoverId);
      }
    },
    [pinnedPopoverId, popoverId, onActiveChange, clearHideTimeout],
  );

  const handleMouseLeave = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (pinnedPopoverId !== popoverId) {
        // Start a 1 second timer before hiding
        hideTimeoutRef.current = setTimeout(() => {
          // Only hide if we're not hovering over the popover
          if (!isHoveringPopoverRef.current) {
            onActiveChange(null);
          }
        }, 1000);
      }
    },
    [pinnedPopoverId, popoverId, onActiveChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        handleClick();
      }
    },
    [handleClick],
  );

  const popoverContentInner =
    'Your administrator has hidden this option. If you are sure of your choice, you can still use it.';
  const popoverContent = (
    <div
      onMouseEnter={() => {
        clearHideTimeout();
        isHoveringPopoverRef.current = true;
      }}
      onMouseLeave={() => {
        isHoveringPopoverRef.current = false;
        if (pinnedPopoverId !== popoverId) {
          onActiveChange(null);
        }
      }}
    >
      {popoverContentInner}
    </div>
  );
  const isVisible = activePopoverId === popoverId || pinnedPopoverId === popoverId;

  return (
    <div className="pf-v6-u-display-inline-block">
      <Popover
        headerContent="Hidden Option"
        bodyContent={popoverContent}
        minWidth="18.75rem"
        maxWidth="31.25rem"
        isVisible={isVisible}
        shouldClose={() => {
          clearHideTimeout();
          isHoveringPopoverRef.current = false;
          onPinnedChange(null);
          onActiveChange(null);
        }}
        shouldOpen={() => {
          if (!isVisible) {
            onActiveChange(popoverId);
          }
        }}
      >
        <span
          role="button"
          tabIndex={0}
          aria-label="View hidden option information"
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
          data-testid="hidden-icon"
        >
          <Icon isInline>
            <QuestionCircleIcon color="grey" aria-label="Hidden option information" />
          </Icon>
        </span>
      </Popover>
    </div>
  );
};
