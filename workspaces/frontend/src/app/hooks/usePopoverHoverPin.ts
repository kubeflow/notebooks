import React, { useCallback, useEffect, useRef } from 'react';

export interface UsePopoverHoverPinArgs {
  popoverId: string;
  activePopoverId: string | null;
  pinnedPopoverId: string | null;
  onActiveChange: (id: string | null) => void;
  onPinnedChange: (id: string | null) => void;
}

export interface UsePopoverHoverPinReturn {
  triggerProps: {
    role: 'button';
    tabIndex: number;
    onClick: (e?: React.MouseEvent) => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    onMouseEnter: (e: React.MouseEvent) => void;
    onMouseLeave: (e: React.MouseEvent) => void;
  };
  contentProps: {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
  };
  popoverProps: {
    isVisible: boolean;
    shouldClose: () => void;
    shouldOpen: () => void;
  };
}

export const usePopoverHoverPin = ({
  popoverId,
  activePopoverId,
  pinnedPopoverId,
  onActiveChange,
  onPinnedChange,
}: UsePopoverHoverPinArgs): UsePopoverHoverPinReturn => {
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isHoveringPopoverRef = useRef(false);

  const clearHideTimeout = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  // Don't leave a timer running after the icon unmounts
  useEffect(() => clearHideTimeout, [clearHideTimeout]);

  const isPinned = pinnedPopoverId === popoverId;
  const isVisible = activePopoverId === popoverId || isPinned;

  const handleClick = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      clearHideTimeout();
      if (isPinned) {
        onPinnedChange(null);
      } else {
        onPinnedChange(popoverId);
        onActiveChange(null);
      }
    },
    [isPinned, popoverId, onPinnedChange, onActiveChange, clearHideTimeout],
  );

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      clearHideTimeout();
      if (!isPinned) {
        onActiveChange(popoverId);
      }
    },
    [isPinned, popoverId, onActiveChange, clearHideTimeout],
  );

  const handleMouseLeave = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isPinned) {
        hideTimeoutRef.current = setTimeout(() => {
          if (!isHoveringPopoverRef.current) {
            onActiveChange(null);
          }
        }, 1000);
      }
    },
    [isPinned, onActiveChange],
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

  return {
    // spread onto the clickable trigger <span>
    triggerProps: {
      role: 'button' as const,
      tabIndex: 0,
      onClick: handleClick,
      onKeyDown: handleKeyDown,
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
    },
    // spread onto the <div> wrapping the popover body
    contentProps: {
      onMouseEnter: () => {
        clearHideTimeout();
        isHoveringPopoverRef.current = true;
      },
      onMouseLeave: () => {
        isHoveringPopoverRef.current = false;
        if (!isPinned) {
          onActiveChange(null);
        }
      },
    },
    // spread onto <Popover>
    popoverProps: {
      isVisible,
      shouldClose: () => {
        clearHideTimeout();
        isHoveringPopoverRef.current = false;
        onPinnedChange(null);
        onActiveChange(null);
      },
      shouldOpen: () => {
        if (!isVisible) {
          onActiveChange(popoverId);
        }
      },
    },
  };
};
