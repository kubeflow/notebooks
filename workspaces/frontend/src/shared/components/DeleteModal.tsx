import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
} from '@patternfly/react-core/dist/esm/components/Modal';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { Form } from '@patternfly/react-core/dist/esm/components/Form';
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput';
import { Checkbox } from '@patternfly/react-core/dist/esm/components/Checkbox';
import { Stack, StackItem } from '@patternfly/react-core/dist/esm/layouts/Stack';
import { HelperText, HelperTextItem } from '@patternfly/react-core/dist/esm/components/HelperText';
import { default as ExclamationCircleIcon } from '@patternfly/react-icons/dist/esm/icons/exclamation-circle-icon';
import { useThemeContext } from 'mod-arch-kubeflow';
import { ActionButton } from '~/shared/components/ActionButton';
import { ErrorAlert } from '~/shared/components/ErrorAlert';
import ThemeAwareFormGroupWrapper from '~/shared/components/ThemeAwareFormGroupWrapper';
import { extractErrorMessage } from '~/shared/api/apiUtils';
import { ApiErrorEnvelope } from '~/generated/data-contracts';

export interface DeleteOptions {
  deleteHomeVolume: boolean;
}

interface DeleteModalProps {
  isOpen: boolean;
  resourceName: string;
  namespace?: string;
  onClose: () => void;
  onDelete: (resourceName: string, options?: DeleteOptions) => Promise<void>;
  title: string;
  errorTitle?: string;
  message?: React.ReactNode;
  /**
   * Home PersistentVolumeClaim mounted by this workspace.
   * When set, the dialog offers to delete that volume together with the workspace.
   * The box starts unchecked, so the volume is kept unless the user opts in.
   */
  homeVolumeName?: string;
}

const DeleteModal: React.FC<DeleteModalProps> = ({
  isOpen,
  resourceName,
  namespace,
  title,
  errorTitle = 'Failed to delete workspace',
  message,
  onClose,
  onDelete,
  homeVolumeName,
}) => {
  const { isMUITheme } = useThemeContext();
  const [inputValue, setInputValue] = useState('');
  const [deleteHomeVolume, setDeleteHomeVolume] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | ApiErrorEnvelope | null>(null);
  const isDeletingRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      setInputValue('');
      setDeleteHomeVolume(false);
      setError(null);
      isDeletingRef.current = false;
      setIsDeleting(false);
    }
  }, [isOpen]);

  const handleDelete = useCallback(async () => {
    if (isDeletingRef.current || inputValue !== resourceName) {
      return;
    }

    isDeletingRef.current = true;
    setIsDeleting(true);
    setError(null);

    try {
      if (homeVolumeName) {
        await onDelete(resourceName, { deleteHomeVolume });
      } else {
        await onDelete(resourceName);
      }
      onClose();
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      isDeletingRef.current = false;
      setIsDeleting(false);
    }
  }, [deleteHomeVolume, homeVolumeName, inputValue, onClose, onDelete, resourceName]);

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
        <Stack hasGutter={!isMUITheme}>
          {error && (
            <StackItem>
              <ErrorAlert title={errorTitle} content={error} testId="delete-modal-error" />
            </StackItem>
          )}
          <StackItem>
            {message || (
              <>
                Are you sure you want to delete <strong>{resourceName}</strong>
                {namespace && (
                  <>
                    {' '}
                    in namespace <strong>{namespace}</strong>
                  </>
                )}
                ?
              </>
            )}
          </StackItem>
          <StackItem>
            <Form
              onSubmit={(e) => {
                e.preventDefault();
                handleDelete();
              }}
            >
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
            </Form>
          </StackItem>
          {homeVolumeName && (
            <StackItem>
              <Checkbox
                id="delete-home-volume"
                label={`Also delete the home volume ${homeVolumeName}`}
                description="Deletes this PersistentVolumeClaim and the files stored on it. Data volumes mounted beside the home directory stay."
                isChecked={deleteHomeVolume}
                onChange={(_event, checked) => setDeleteHomeVolume(checked)}
                data-testid="delete-home-volume-checkbox"
              />
            </StackItem>
          )}
        </Stack>
      </ModalBody>
      <ModalFooter>
        <div style={{ marginTop: '1rem' }}>
          <ActionButton
            action="Delete"
            titleOnLoading="Deleting ..."
            onClick={handleDelete}
            variant="danger"
            isDisabled={inputValue !== resourceName || isDeleting}
            aria-disabled={inputValue !== resourceName || isDeleting}
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
