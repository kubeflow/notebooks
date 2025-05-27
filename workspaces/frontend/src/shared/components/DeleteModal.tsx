import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
  Button,
  TextInput,
  Stack,
  StackItem,
  FlexItem,
  HelperText,
  HelperTextItem,
} from '@patternfly/react-core';
import { default as ExclamationCircleIcon } from '@patternfly/react-icons/dist/esm/icons/exclamation-circle-icon';
import { ActionButton } from '~/shared/components/ActionButton';

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
  const [isDeleting, setIsDeleting] = React.useState(false);

  useEffect(() => {
    if (!isOpen) {
      setInputValue('');
    }
  }, [isOpen]);

  const handleDelete = useCallback(async () => {
    if (inputValue === resourceName) {
      setIsDeleting(true);
      await onDelete(resourceName);
      setIsDeleting(false);

      onClose();
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
          <StackItem>
            <FlexItem>
              Are you sure you want to delete <strong>{resourceName}</strong> in namespace{' '}
              <strong>{namespace}</strong>?
              <br />
              <br />
              Please type the resource name to confirm:
            </FlexItem>
            <TextInput
              value={inputValue}
              type="text"
              onChange={handleInputChange}
              aria-label="Resource name confirmation"
              validated={showWarning ? 'error' : 'default'}
              data-testid="delete-modal-input"
            />
            {showWarning && (
              <HelperText data-testid="delete-modal-helper-text">
                <HelperTextItem icon={<ExclamationCircleIcon />} variant="error">
                  The name doesn&apos;t match. Please enter exactly: {resourceName}
                </HelperTextItem>
              </HelperText>
            )}
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
          >
            Delete
          </ActionButton>
          {!isDeleting && (
            <Button onClick={onClose} variant="link" style={{ marginLeft: '1rem' }}>
              Cancel
            </Button>
          )}
        </div>
      </ModalFooter>
    </Modal>
  );
};

export default DeleteModal;
