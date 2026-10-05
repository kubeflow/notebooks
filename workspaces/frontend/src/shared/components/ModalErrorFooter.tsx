import React from 'react';
import { ModalFooter } from '@patternfly/react-core/dist/esm/components/Modal';
import { Flex } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { Stack, StackItem } from '@patternfly/react-core/dist/esm/layouts/Stack';
import { ApiErrorEnvelope } from '~/generated/data-contracts';
import { ErrorAlert } from '~/shared/components/ErrorAlert';

type ModalErrorFooterProps = {
  error: string | ApiErrorEnvelope | null;
  errorTitle?: string;
  errorTestId: string;
  children: React.ReactNode;
};

/**
 * Modal footer that renders the error alert directly above the action buttons,
 * so the reason an action failed is visible without scrolling a long modal body.
 */
export const ModalErrorFooter: React.FC<ModalErrorFooterProps> = ({
  error,
  errorTitle = 'Error',
  errorTestId,
  children,
}) => (
  <ModalFooter>
    <Stack hasGutter className="pf-v6-u-w-100">
      {error && (
        <StackItem>
          <ErrorAlert title={errorTitle} content={error} testId={errorTestId} />
        </StackItem>
      )}
      <StackItem>
        <Flex gap={{ default: 'gapMd' }}>{children}</Flex>
      </StackItem>
    </Stack>
  </ModalFooter>
);
