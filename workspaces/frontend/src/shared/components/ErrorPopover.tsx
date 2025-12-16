import React from 'react';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { Popover } from '@patternfly/react-core/dist/esm/components/Popover';
import { ExclamationCircleIcon } from '@patternfly/react-icons/dist/esm/icons/exclamation-circle-icon';

type ErrorPopoverProps = {
  title: string;
  message: string;
};

export const ErrorPopover: React.FC<ErrorPopoverProps> = ({ title, message }) => (
  <Popover aria-label="Error details" headerContent={title} bodyContent={message}>
    <Button variant="plain" aria-label="Error details" className="pf-v6-u-p-0">
      <ExclamationCircleIcon color="var(--pf-t--global--icon--color--status--danger--default)" />
    </Button>
  </Popover>
);
