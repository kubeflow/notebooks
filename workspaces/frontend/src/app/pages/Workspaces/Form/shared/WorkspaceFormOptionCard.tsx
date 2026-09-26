import React from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardBody,
} from '@patternfly/react-core/dist/esm/components/Card';
import { Label } from '@patternfly/react-core/dist/esm/components/Label';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { css } from '@patternfly/react-styles';
import { Popover } from '@patternfly/react-core/dist/esm/components/Popover';
import { Icon } from '@patternfly/react-core/dist/esm/components/Icon';
import { ExclamationCircleIcon } from '@patternfly/react-icons/dist/esm/icons/exclamation-circle-icon';
import { HiddenIconWithPopover } from '~/app/components/HiddenIconWithPopover';
import { RedirectIconWithPopover } from '~/app/components/RedirectIconWithPopover';
import {
  OptionValue,
  resolveRedirectChain,
} from '~/app/pages/Workspaces/Form/utils/resolveRedirectChain';

interface WorkspaceFormOptionCardProps {
  option: OptionValue;
  isSelected: boolean;
  isDefault: boolean;
  onClick: (option: OptionValue) => void;
  onChange: (event: React.FormEvent<HTMLInputElement>) => void;
  activePopoverId: string | null;
  pinnedPopoverId: string | null;
  onActivePopoverChange: (id: string | null) => void;
  onPinnedPopoverChange: (id: string | null) => void;
}

export const WorkspaceFormOptionCard: React.FC<
  WorkspaceFormOptionCardProps & { allOptions: OptionValue[] }
> = ({
  option,
  isSelected,
  isDefault,
  onClick,
  onChange,
  activePopoverId,
  pinnedPopoverId,
  onActivePopoverChange,
  onPinnedPopoverChange,
  allOptions,
}) => {
  const { chain: redirectChain } = option.redirect
    ? resolveRedirectChain(option, allOptions)
    : { chain: undefined };
  const cardId = option.id.replace(/ /g, '-');
  const popoverIdHidden = `hidden-${cardId}`;
  const popoverIdRedirect = `redirect-${cardId}`;
  const isDenied = option.restrictions.deny === true;
  const isRedirect = option.redirect !== undefined;

  const cardClasses = css(
    'workspace-option-card',
    option.hidden && 'workspace-option-card--hidden',
    isRedirect && 'workspace-option-card--redirected',
    isDenied && 'workspace-option-card--restricted',
  );

  const handleCardClick = (event: React.MouseEvent) => {
    if (isDenied) {
      return;
    }
    // Check if click originated from an icon (hidden or redirect)
    const target = event.target as HTMLElement;
    const clickedIcon = target.closest(
      '[data-testid="hidden-icon"], [data-testid="redirect-icon"]',
    );

    // Only trigger card selection if not clicking on an icon
    if (!clickedIcon) {
      onClick(option);
    }
  };

  return (
    <Card
      isCompact
      id={cardId}
      isSelected={isSelected}
      isSelectable={!isDenied}
      isDisabled={isDenied}
      className={cardClasses}
      onClick={handleCardClick}
    >
      <CardHeader
        selectableActions={{
          selectableActionId: `selectable-actions-item-${cardId}`,
          selectableActionAriaLabelledby: option.displayName.replace(/ /g, '-'),
          name: option.displayName,
          variant: 'single',
          onChange,
        }}
        className={
          option.hidden || option.redirect ? 'workspace-option-card__header--with-icons' : undefined
        }
        data-testid={`option-card-header-${cardId}`}
      >
        <CardTitle>{option.displayName}</CardTitle>
      </CardHeader>
      {option.description && (
        <CardBody
          className="workspace-option-card__description"
          data-testid={`option-card-description-${cardId}`}
        >
          {option.description}
        </CardBody>
      )}
      <Flex
        alignItems={{ default: 'alignItemsCenter' }}
        spaceItems={{ default: 'spaceItemsSm' }}
        className="workspace-option-card__icons-container"
        data-testid={`option-card-icons-${cardId}`}
      >
        {isDenied && (
          <FlexItem>
            <Popover
              aria-label="Restricted option information"
              headerContent={<div>Restricted</div>}
              bodyContent={
                <div>{option.restrictions.denyMessage?.text ?? 'This option is restricted.'}</div>
              }
            >
              <Icon status="danger" isInline>
                <ExclamationCircleIcon />
              </Icon>
            </Popover>
          </FlexItem>
        )}

        {isDefault && (
          <FlexItem>
            <Label color="blue" isCompact>
              Default
            </Label>
          </FlexItem>
        )}
        {option.hidden && (
          <FlexItem>
            <HiddenIconWithPopover
              popoverId={popoverIdHidden}
              activePopoverId={activePopoverId}
              pinnedPopoverId={pinnedPopoverId}
              onActiveChange={onActivePopoverChange}
              onPinnedChange={onPinnedPopoverChange}
            />
          </FlexItem>
        )}
        {redirectChain && (
          <FlexItem>
            <RedirectIconWithPopover
              redirectChain={redirectChain}
              popoverId={popoverIdRedirect}
              activePopoverId={activePopoverId}
              pinnedPopoverId={pinnedPopoverId}
              onActiveChange={onActivePopoverChange}
              onPinnedChange={onPinnedPopoverChange}
            />
          </FlexItem>
        )}
      </Flex>
    </Card>
  );
};
