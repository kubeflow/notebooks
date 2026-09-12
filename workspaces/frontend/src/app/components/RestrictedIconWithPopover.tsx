import * as React from 'react';
import { Popover } from '@patternfly/react-core/dist/esm/components/Popover';
import { BanIcon } from '@patternfly/react-icons/dist/esm/icons/ban-icon';

interface RestrictedIconWithPopoverProps {
  id: string;
  message: string;
}

export const RestrictedIconWithPopover: React.FC<RestrictedIconWithPopoverProps> = ({
  id,
  message,
}) => (
  <Popover id={id} bodyContent={message} triggerAction="hover">
    <BanIcon aria-label="Restricted option" className="workspace-option-card__restricted-icon" />
  </Popover>
);
