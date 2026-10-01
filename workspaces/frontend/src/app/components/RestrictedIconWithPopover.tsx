import React from 'react';
import { Popover } from '@patternfly/react-core/dist/esm/components/Popover';
import { Icon } from '@patternfly/react-core/dist/esm/components/Icon';
import { ExclamationCircleIcon } from '@patternfly/react-icons/dist/esm/icons/exclamation-circle-icon';
import { usePopoverHoverPin, UsePopoverHoverPinArgs } from '~/app/hooks/usePopoverHoverPin';

interface RestrictedIconWithPopoverProps extends UsePopoverHoverPinArgs {
  message?: string;
}

export const RestrictedIconWithPopover: React.FC<RestrictedIconWithPopoverProps> = ({
  message,
  ...popoverArgs
}) => {
  const { triggerProps, contentProps, popoverProps } = usePopoverHoverPin(popoverArgs);

  return (
    <div className="pf-v6-u-display-inline-block">
      <Popover
        id={popoverArgs.popoverId}
        aria-label="Restricted option information"
        headerContent="Restricted"
        bodyContent={<div {...contentProps}>{message ?? 'This option is restricted.'}</div>}
        minWidth="18.75rem"
        maxWidth="31.25rem"
        {...popoverProps}
      >
        <span
          {...triggerProps}
          aria-label="View restricted option information"
          style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
          data-testid="restricted-icon"
        >
          <Icon status="danger" isInline>
            <ExclamationCircleIcon aria-label="Restricted option information" />
          </Icon>
        </span>
      </Popover>
    </div>
  );
};
