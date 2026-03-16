import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
} from '@patternfly/react-core/dist/esm/components/Modal';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { Stack, StackItem } from '@patternfly/react-core/dist/esm/layouts/Stack';
import { ApiErrorEnvelope } from '~/generated/data-contracts';
import { ActionButton } from '~/shared/components/ActionButton';
import { ErrorAlert } from '~/shared/components/ErrorAlert';
import { extractErrorMessage } from '~/shared/api/apiUtils';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  titleIconVariant?: 'warning' | 'danger' | 'info' | 'success' | 'custom';
  children: React.ReactNode;
  confirmLabel: string;
  confirmLabelOnLoading: string;
  confirmVariant?: React.ComponentProps<typeof Button>['variant'];
  onConfirm: () => Promise<void>;
  onClose: () => void;
  errorTitle: string;
  testId?: string;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  titleIconVariant = 'warning',
  children,
  confirmLabel,
  confirmLabelOnLoading,
  confirmVariant = 'danger',
  onConfirm,
  onClose,
  errorTitle,
  testId,
}) => {
  const [error, setError] = useState<string | ApiErrorEnvelope | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setError(null);
    }
  }, [isOpen]);

  const handleConfirm = useCallback(async () => {
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  }, [onConfirm, onClose]);

  return (
    <Modal variant={ModalVariant.small} isOpen={isOpen} onClose={onClose} data-testid={testId}>
      <ModalHeader title={title} titleIconVariant={titleIconVariant} />
      <ModalBody>
        <Stack hasGutter>
          {error && (
            <StackItem>
              <ErrorAlert title={errorTitle} content={error} testId="confirm-modal-error" />
            </StackItem>
          )}
          <StackItem>{children}</StackItem>
        </Stack>
      </ModalBody>
      <ModalFooter>
        <ActionButton
          action={confirmLabel}
          titleOnLoading={confirmLabelOnLoading}
          onClick={handleConfirm}
          variant={confirmVariant}
          data-testid="confirm-button"
        >
          {confirmLabel}
        </ActionButton>
        <Button variant="link" onClick={onClose} data-testid="cancel-button">
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
