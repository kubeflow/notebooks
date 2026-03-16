import React, { FC, useRef, useCallback } from 'react';
import { Popover } from '@patternfly/react-core/dist/esm/components/Popover';
import { Icon } from '@patternfly/react-core/dist/esm/components/Icon';
import { ExclamationTriangleIcon } from '@patternfly/react-icons/dist/esm/icons/exclamation-triangle-icon';
import { WorkspacekindsRedirectMessageLevel } from '~/generated/data-contracts';

interface SummaryRedirectIconProps {
  step: number;
  popoverIdSuffix: string;
  displayName: string;
  targetDisplayName: string;
  redirect: {
    to: string;
    message?: {
      level: WorkspacekindsRedirectMessageLevel;
      text: string;
    };
  };
  onClickTarget: () => void;
  activePopoverId: string | null;
  pinnedPopoverId: string | null;
  setActivePopoverId: (id: string | null) => void;
  setPinnedPopoverId: (id: string | null) => void;
  buildRedirectPopoverContent: (args: {
    displayName: string;
    targetDisplayName: string;
    redirect: {
      to: string;
      message?: {
        level: WorkspacekindsRedirectMessageLevel;
        text: string;
      };
    };
    onClickTarget: () => void;
  }) => React.ReactNode;
}

export const SummaryRedirectIcon: FC<SummaryRedirectIconProps> = ({
  step,
  popoverIdSuffix,
  displayName,
  targetDisplayName,
  redirect,
  onClickTarget,
  activePopoverId,
  pinnedPopoverId,
  setActivePopoverId,
  setPinnedPopoverId,
  buildRedirectPopoverContent,
}) => {
  const popoverId = `redirect-summary-${step}-${popoverIdSuffix}`;
  const isVisible = activePopoverId === popoverId || pinnedPopoverId === popoverId;

  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isHoveringPopoverRef = useRef(false);

  const clearHideTimeout = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  const popoverContentInner = buildRedirectPopoverContent({
    displayName,
    targetDisplayName,
    redirect,
    onClickTarget,
  });

  const popoverContent = (
    <div
      data-testid={`redirect-popover-content-${step}-${popoverIdSuffix}`}
      onMouseEnter={() => {
        clearHideTimeout();
        isHoveringPopoverRef.current = true;
      }}
      onMouseLeave={() => {
        isHoveringPopoverRef.current = false;
        if (pinnedPopoverId !== popoverId) {
          setActivePopoverId(null);
        }
      }}
    >
      {popoverContentInner}
    </div>
  );

  return (
    <div className="pf-v6-u-display-inline-block">
      <Popover
        headerContent="Redirect Information"
        bodyContent={popoverContent}
        minWidth="25rem"
        maxWidth="37.5rem"
        isVisible={isVisible}
        shouldClose={() => {
          clearHideTimeout();
          isHoveringPopoverRef.current = false;
          setPinnedPopoverId(null);
          setActivePopoverId(null);
        }}
        shouldOpen={() => {
          if (!isVisible) {
            setActivePopoverId(popoverId);
          }
        }}
      >
        <span
          role="button"
          tabIndex={0}
          aria-label="View redirect information"
          onClick={(e) => {
            e.stopPropagation();
            clearHideTimeout();
            if (pinnedPopoverId === popoverId) {
              setPinnedPopoverId(null);
            } else {
              setPinnedPopoverId(popoverId);
              setActivePopoverId(null);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              clearHideTimeout();
              if (pinnedPopoverId === popoverId) {
                setPinnedPopoverId(null);
              } else {
                setPinnedPopoverId(popoverId);
                setActivePopoverId(null);
              }
            }
          }}
          onMouseEnter={(e) => {
            e.stopPropagation();
            clearHideTimeout();
            if (pinnedPopoverId !== popoverId) {
              setActivePopoverId(popoverId);
            }
          }}
          onMouseLeave={(e) => {
            e.stopPropagation();
            if (pinnedPopoverId !== popoverId) {
              // Start a 1 second timer before hiding
              hideTimeoutRef.current = setTimeout(() => {
                // Only hide if we're not hovering over the popover
                if (!isHoveringPopoverRef.current) {
                  setActivePopoverId(null);
                }
              }, 1000);
            }
          }}
          className="summary-redirect-icon-button"
          data-testid={`redirect-icon-${step}-${popoverIdSuffix}`}
        >
          <Icon isInline>
            <ExclamationTriangleIcon color="orange" aria-label="Redirect information" />
          </Icon>
        </span>
      </Popover>
    </div>
  );
};
