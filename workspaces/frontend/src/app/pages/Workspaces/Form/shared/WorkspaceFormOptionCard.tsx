import React from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardBody,
} from '@patternfly/react-core/dist/esm/components/Card';
import { Label } from '@patternfly/react-core/dist/esm/components/Label';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { HiddenIconWithPopover } from '~/app/components/HiddenIconWithPopover';
import { RedirectIconWithPopover } from '~/app/components/RedirectIconWithPopover';
import {
  WorkspacekindsImageConfigValue,
  WorkspacekindsPodConfigValue,
  WorkspacesRedirectStep,
  WorkspacesRedirectMessageLevel,
  WorkspacekindsRedirectMessageLevel,
} from '~/generated/data-contracts';

type OptionValue = WorkspacekindsImageConfigValue | WorkspacekindsPodConfigValue;

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

const transformRedirectMessageLevel = (
  level?: WorkspacekindsRedirectMessageLevel,
): WorkspacesRedirectMessageLevel => {
  switch (level) {
    case WorkspacekindsRedirectMessageLevel.RedirectMessageLevelInfo:
      return WorkspacesRedirectMessageLevel.RedirectMessageLevelInfo;
    case WorkspacekindsRedirectMessageLevel.RedirectMessageLevelWarning:
      return WorkspacesRedirectMessageLevel.RedirectMessageLevelWarning;
    case WorkspacekindsRedirectMessageLevel.RedirectMessageLevelDanger:
      return WorkspacesRedirectMessageLevel.RedirectMessageLevelDanger;
    default:
      return WorkspacesRedirectMessageLevel.RedirectMessageLevelInfo;
  }
};

const transformRedirectToChain = (
  option: OptionValue,
  allOptions: OptionValue[],
): WorkspacesRedirectStep[] | undefined => {
  if (!option.redirect) {
    return undefined;
  }

  const targetOption = allOptions.find((opt) => opt.id === option.redirect?.to);

  const targetInfo = targetOption
    ? {
        id: targetOption.id,
        displayName: targetOption.displayName,
        description: targetOption.description,
        labels: targetOption.labels.map((label) => ({ key: label.key, value: label.value })),
      }
    : {
        id: option.redirect.to,
        displayName: `${option.redirect.to} (not found)`,
        description: '',
        labels: [],
      };

  const step: WorkspacesRedirectStep = {
    source: {
      id: option.id,
      displayName: option.displayName,
      description: option.description,
      labels: option.labels.map((label) => ({ key: label.key, value: label.value })),
    },
    target: targetInfo,
  };

  if (option.redirect.message) {
    step.message = {
      level: transformRedirectMessageLevel(option.redirect.message.level),
      text: option.redirect.message.text,
    };
  }

  return [step];
};

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
  const redirectChain = transformRedirectToChain(option, allOptions);
  const cardId = option.id.replace(/ /g, '-');
  const popoverIdHidden = `hidden-${cardId}`;
  const popoverIdRedirect = `redirect-${cardId}`;

  const cardClasses = [
    option.hidden ? 'workspace-option-card--hidden' : '',
    option.redirect ? 'workspace-option-card--redirected' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const handleCardClick = (e: React.MouseEvent) => {
    // Check if click originated from an icon (hidden or redirect)
    const target = e.target as HTMLElement;
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
      isSelectable
      key={option.id}
      id={cardId}
      isSelected={isSelected}
      onClick={handleCardClick}
      className={cardClasses}
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
