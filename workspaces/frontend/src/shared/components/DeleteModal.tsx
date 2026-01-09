import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
} from '@patternfly/react-core/dist/esm/components/Modal';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput';
import { Stack, StackItem } from '@patternfly/react-core/dist/esm/layouts/Stack';
import { FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { HelperText, HelperTextItem } from '@patternfly/react-core/dist/esm/components/HelperText';
import { default as ExclamationCircleIcon } from '@patternfly/react-icons/dist/esm/icons/exclamation-circle-icon';
import { ActionButton } from '~/shared/components/ActionButton';
import { ErrorAlert } from '~/shared/components/ErrorAlert';
import ThemeAwareFormGroupWrapper from '~/shared/components/ThemeAwareFormGroupWrapper';
import { extractErrorMessage } from '~/shared/api/apiUtils';
import { ApiErrorEnvelope } from '~/generated/data-contracts';

interface DeleteModalProps {
  isOpen: boolean;
  resourceName: string;
  namespace: string;
  onClose: () => void;
  onDelete: (resourceName: string) => Promise<void>;
  title: string;
}

const DeleteModal: React.FC<DeleteModalProps> = ({
  isOpen,
  resourceName,
  namespace,
  title,
  onClose,
  onDelete,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | ApiErrorEnvelope | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setInputValue('');
      setError(null);
    }
  }, [isOpen]);

  const handleDelete = useCallback(async () => {
    if (inputValue === resourceName) {
      setIsDeleting(true);
      setError(null);
      try {
        await onDelete(resourceName);
        onClose();
      } catch (err) {
        setError(extractErrorMessage(err));
      } finally {
        setIsDeleting(false);
      }
    } else {
      alert('Resource name does not match.');
    }
  }, [inputValue, onClose, onDelete, resourceName]);

  const handleInputChange = (event: React.FormEvent<HTMLInputElement>, value: string) => {
    setInputValue(value);
  };

  const showWarning = inputValue !== '' && inputValue !== resourceName;

  return (
    <Modal
      data-testid="delete-modal"
      variant={ModalVariant.small}
      title="Confirm Deletion"
      isOpen={isOpen}
      onClose={onClose}
    >
      <ModalHeader title={title} titleIconVariant="warning" />
      <ModalBody>
        <Stack hasGutter>
          {error && (
            <StackItem>
              <ErrorAlert
                title="Failed to delete workspace"
                content={error}
                testId="delete-modal-error"
              />
            </StackItem>
          )}
          <StackItem>
            <FlexItem>
              Are you sure you want to delete <strong>{resourceName}</strong> in namespace{' '}
              <strong>{namespace}</strong>?
            </FlexItem>
          </StackItem>
          <StackItem>
            <ThemeAwareFormGroupWrapper
              label="Please type the resource name to confirm:"
              fieldId="delete-modal-input"
              hasError={showWarning}
              helperTextNode={
                showWarning ? (
                  <HelperText data-testid="delete-modal-helper-text">
                    <HelperTextItem icon={<ExclamationCircleIcon />} variant="error">
                      The name does not match. Please enter exactly: {resourceName}
                    </HelperTextItem>
                  </HelperText>
                ) : null
              }
            >
              <TextInput
                value={inputValue}
                type="text"
                onChange={handleInputChange}
                aria-label="Resource name confirmation"
                validated={showWarning ? 'error' : 'default'}
                data-testid="delete-modal-input"
              />
            </ThemeAwareFormGroupWrapper>
          </StackItem>
        </Stack>
      </ModalBody>
      <ModalFooter>
        <div style={{ marginTop: '1rem' }}>
          <ActionButton
            action="Delete"
            titleOnLoading="Deleting ..."
            onClick={handleDelete}
            variant="danger"
            isDisabled={inputValue !== resourceName}
            aria-disabled={inputValue !== resourceName}
            data-testid="delete-button"
          >
            Delete
          </ActionButton>
          {!isDeleting && (
            <Button
              onClick={onClose}
              variant="link"
              style={{ marginLeft: '1rem' }}
              data-testid="cancel-button"
            >
              Cancel
            </Button>
          )}
        </div>
      </ModalFooter>
    </Modal>
  );
};

export default DeleteModal;
