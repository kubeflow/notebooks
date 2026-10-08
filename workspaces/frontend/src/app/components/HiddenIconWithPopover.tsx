import React from 'react';
import { Popover } from '@patternfly/react-core/dist/esm/components/Popover';
import { Icon } from '@patternfly/react-core/dist/esm/components/Icon';
import { ExclamationCircleIcon } from '@patternfly/react-icons/dist/esm/icons/exclamation-circle-icon';
import { QuestionCircleIcon } from '@patternfly/react-icons/dist/esm/icons/question-circle-icon';
import { usePopoverHoverPin, UsePopoverHoverPinArgs } from '~/app/hooks/usePopoverHoverPin';

type IconWithPopoverType = 'restricted' | 'hidden';

interface IconWithPopoverProps extends UsePopoverHoverPinArgs {
  type: IconWithPopoverType;
  message?: string;
}

interface IconWithPopoverConfig {
  headerContent: string;
  defaultMessage: string;
  triggerAriaLabel: string;
  iconAriaLabel: string;
  testId: string;
  icon: React.ReactNode;
  iconStatus?: 'danger';
}

const ICON_WITH_POPOVER_CONFIG: Record<IconWithPopoverType, IconWithPopoverConfig> = {
  restricted: {
    headerContent: 'Restricted',
    defaultMessage: 'This option is restricted.',
    triggerAriaLabel: 'View restricted option information',
    iconAriaLabel: 'Restricted option information',
    testId: 'restricted-icon',
    icon: <ExclamationCircleIcon aria-label="Restricted option information" />,
    iconStatus: 'danger',
  },
  hidden: {
    headerContent: 'Hidden Option',
    defaultMessage:
      'Your administrator has hidden this option. If you are sure of your choice, you can still use it.',
    triggerAriaLabel: 'View hidden option information',
    iconAriaLabel: 'Hidden option information',
    testId: 'hidden-icon',
    icon: <QuestionCircleIcon color="grey" aria-label="Hidden option information" />,
  },
};

export const HiddenIconWithPopover: React.FC<IconWithPopoverProps> = ({
  type,
  message,
  ...popoverArgs
}) => {
  const { triggerProps, contentProps, popoverProps } = usePopoverHoverPin(popoverArgs);
  const config = ICON_WITH_POPOVER_CONFIG[type];

  return (
    <div className="pf-v6-u-display-inline-block">
      <Popover
        id={popoverArgs.popoverId}
        aria-label={config.iconAriaLabel}
        headerContent={config.headerContent}
        bodyContent={<div {...contentProps}>{message ?? config.defaultMessage}</div>}
        minWidth="18.75rem"
        maxWidth="31.25rem"
        {...popoverProps}
      >
        <span
          {...triggerProps}
          aria-label={config.triggerAriaLabel}
          style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
          data-testid={config.testId}
        >
          <Icon status={config.iconStatus} isInline>
            {config.icon}
          </Icon>
        </span>
      </Popover>
    </div>
  );
};
