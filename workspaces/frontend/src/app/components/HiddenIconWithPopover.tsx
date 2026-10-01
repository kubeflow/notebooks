import React from 'react';
import { Popover } from '@patternfly/react-core/dist/esm/components/Popover';
import { Icon } from '@patternfly/react-core/dist/esm/components/Icon';
import { QuestionCircleIcon } from '@patternfly/react-icons/dist/esm/icons/question-circle-icon';
import { usePopoverHoverPin, UsePopoverHoverPinArgs } from '~/app/hooks/usePopoverHoverPin';

export const HiddenIconWithPopover: React.FC<UsePopoverHoverPinArgs> = (props) => {
  const { triggerProps, contentProps, popoverProps } = usePopoverHoverPin(props);

  return (
    <div className="pf-v6-u-display-inline-block">
      <Popover
        headerContent="Hidden Option"
        bodyContent={
          <div {...contentProps}>
            Your administrator has hidden this option. If you are sure of your choice, you can still
            use it.
          </div>
        }
        minWidth="18.75rem"
        maxWidth="31.25rem"
        {...popoverProps}
      >
        <span
          {...triggerProps}
          aria-label="View hidden option information"
          style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
          data-testid="hidden-icon"
        >
          <Icon isInline>
            <QuestionCircleIcon color="grey" aria-label="Hidden option information" />
          </Icon>
        </span>
      </Popover>
    </div>
  );
};
