import React from 'react';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { Popover } from '@patternfly/react-core/dist/esm/components/Popover';
import { ExclamationCircleIcon } from '@patternfly/react-icons/dist/esm/icons/exclamation-circle-icon';
import { ApiErrorEnvelope } from '~/generated/data-contracts';

type ErrorPopoverProps = {
  title: string;
  content: string | ApiErrorEnvelope;
};

export const ErrorPopover: React.FC<ErrorPopoverProps> = ({ title, content }) => {
  const bodyContent = typeof content === 'string' ? content : content.error.message;
  return (
    <Popover aria-label="Error details" headerContent={title} bodyContent={bodyContent}>
      <Button variant="plain" aria-label="Error details" className="pf-v6-u-p-0">
        <ExclamationCircleIcon color="var(--pf-t--global--icon--color--status--danger--default)" />
      </Button>
    </Popover>
  );
};
