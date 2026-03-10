import React, { useCallback } from 'react';
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
  const handleClick = useCallback(
    (e?: React.MouseEvent) => {
      if (e) {
        e.stopPropagation();
      }
      if (pinnedPopoverId === popoverId) {
        onPinnedChange(null);
      } else {
        onPinnedChange(popoverId);
        onActiveChange(null);
      }
    },
    [pinnedPopoverId, popoverId, onPinnedChange, onActiveChange],
  );

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (pinnedPopoverId !== popoverId) {
        onActiveChange(popoverId);
      }
    },
    [pinnedPopoverId, popoverId, onActiveChange],
  );

  const handleMouseLeave = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (pinnedPopoverId !== popoverId) {
        onActiveChange(null);
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

  const isVisible = activePopoverId === popoverId || pinnedPopoverId === popoverId;

  return (
    <div style={{ display: 'inline-block' }}>
      <Popover
        headerContent="Hidden Option"
        bodyContent="Your administrator has hidden this option. If you are sure of your choice, you can still use it."
        minWidth="18.75rem"
        maxWidth="31.25rem"
        isVisible={isVisible}
        shouldClose={() => {
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
