import React, { useCallback } from 'react';
import { Popover } from '@patternfly/react-core/dist/esm/components/Popover';
import { Divider } from '@patternfly/react-core/dist/esm/components/Divider';
import { Icon } from '@patternfly/react-core/dist/esm/components/Icon';
import { Label } from '@patternfly/react-core/dist/esm/components/Label';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { Stack, StackItem } from '@patternfly/react-core/dist/esm/layouts/Stack';
import { ExclamationTriangleIcon } from '@patternfly/react-icons/dist/esm/icons/exclamation-triangle-icon';
import { WorkspacesRedirectStep, WorkspacesRedirectMessageLevel } from '~/generated/data-contracts';

interface RedirectIconWithPopoverProps {
  redirectChain?: WorkspacesRedirectStep[];
  popoverId: string;
  activePopoverId: string | null;
  pinnedPopoverId: string | null;
  onActiveChange: (id: string | null) => void;
  onPinnedChange: (id: string | null) => void;
}

const getMessageLevelColor = (
  level?: WorkspacesRedirectMessageLevel,
): 'blue' | 'orange' | 'red' => {
  switch (level) {
    case WorkspacesRedirectMessageLevel.RedirectMessageLevelInfo:
      return 'blue';
    case WorkspacesRedirectMessageLevel.RedirectMessageLevelWarning:
      return 'orange';
    case WorkspacesRedirectMessageLevel.RedirectMessageLevelDanger:
      return 'red';
    default:
      return 'blue';
  }
};

const getMessageLevelText = (level?: WorkspacesRedirectMessageLevel): string => {
  switch (level) {
    case WorkspacesRedirectMessageLevel.RedirectMessageLevelInfo:
      return 'Info';
    case WorkspacesRedirectMessageLevel.RedirectMessageLevelWarning:
      return 'Warning';
    case WorkspacesRedirectMessageLevel.RedirectMessageLevelDanger:
      return 'Danger';
    default:
      return 'Info';
  }
};

const buildRedirectPopoverContent = (redirectChain: WorkspacesRedirectStep[]): React.ReactNode => {
  if (redirectChain.length === 0) {
    return null;
  }

  return (
    <Stack hasGutter>
      {redirectChain.map((step, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <StackItem>
              <Divider />
            </StackItem>
          )}
          <StackItem>
            <Stack hasGutter>
              <StackItem>
                <Flex
                  alignItems={{ default: 'alignItemsCenter' }}
                  spaceItems={{ default: 'spaceItemsSm' }}
                >
                  {step.message && (
                    <FlexItem>
                      <Label color={getMessageLevelColor(step.message.level)}>
                        {getMessageLevelText(step.message.level)}
                      </Label>
                    </FlexItem>
                  )}
                  <FlexItem>
                    <strong>
                      {step.source.displayName} → {step.target.displayName}
                    </strong>
                  </FlexItem>
                </Flex>
              </StackItem>
              {step.message?.text && <StackItem>{step.message.text}</StackItem>}
            </Stack>
          </StackItem>
        </React.Fragment>
      ))}
    </Stack>
  );
};

export const RedirectIconWithPopover: React.FC<RedirectIconWithPopoverProps> = ({
  redirectChain,
  popoverId,
  activePopoverId,
  pinnedPopoverId,
  onActiveChange,
  onPinnedChange,
}) => {
  const handleClick = useCallback(() => {
    if (pinnedPopoverId === popoverId) {
      onPinnedChange(null);
    } else {
      onPinnedChange(popoverId);
      onActiveChange(null);
    }
  }, [pinnedPopoverId, popoverId, onPinnedChange, onActiveChange]);

  const handleMouseEnter = useCallback(() => {
    if (pinnedPopoverId !== popoverId) {
      onActiveChange(popoverId);
    }
  }, [pinnedPopoverId, popoverId, onActiveChange]);

  const handleMouseLeave = useCallback(() => {
    if (pinnedPopoverId !== popoverId) {
      onActiveChange(null);
    }
  }, [pinnedPopoverId, popoverId, onActiveChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick],
  );

  if (!redirectChain || redirectChain.length === 0) {
    return null;
  }

  const popoverContent = buildRedirectPopoverContent(redirectChain);
  const isVisible = activePopoverId === popoverId || pinnedPopoverId === popoverId;

  return (
    <Popover
      headerContent="Redirect Information"
      bodyContent={popoverContent}
      minWidth="400px"
      maxWidth="600px"
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
        aria-label="View redirect information"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
        data-testid="redirect-icon"
      >
        <Icon isInline>
          <ExclamationTriangleIcon color="orange" aria-label="Redirect information" />
        </Icon>
      </span>
    </Popover>
  );
};
