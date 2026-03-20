import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { Form, FormGroup } from '@patternfly/react-core/dist/esm/components/Form';
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput';
import { Switch } from '@patternfly/react-core/dist/esm/components/Switch';
import { Label, LabelGroup } from '@patternfly/react-core/dist/esm/components/Label';
import {
  Modal,
  ModalVariant,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '@patternfly/react-core/dist/esm/components/Modal';
import { Alert, AlertVariant } from '@patternfly/react-core/dist/esm/components/Alert';
import { Select } from '@patternfly/react-core/dist/esm/components/Select';
import { MenuToggle } from '@patternfly/react-core/dist/esm/components/MenuToggle';
import { HelperText } from '@patternfly/react-core/dist/esm/components/HelperText';
import { useThemeContext } from 'mod-arch-kubeflow';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { useNamespaceSelectorWrapper } from '~/app/hooks/useNamespaceSelectorWrapper';
import { SecretsSecretListItem } from '~/generated/data-contracts';
import ThemeAwareFormGroupWrapper from '~/shared/components/ThemeAwareFormGroupWrapper';
import useSecretContents, { SecretKeyValuePair } from '~/app/hooks/useSecretContents';
import { EditableRowsTable } from '~/app/pages/WorkspaceKinds/Form/EditableRowsTable';

interface SecretsCreateModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSecretCreated?: (secretName: string) => void;
  existingSecretNames?: string[];
  /** When provided, the modal operates in edit mode */
  secretToEdit?: SecretsSecretListItem;
  onSecretUpdated?: (secretName: string) => void;
}

const EMPTY_KEY_VALUE_PAIR: SecretKeyValuePair = { key: '', value: '' };

// DNS-1123 subdomain regex - lowercase alphanumeric, hyphens, dots
// Must start and end with alphanumeric, max 253 chars
const SECRET_NAME_REGEX = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/;

// ConfigMap key regex - alphanumeric, hyphens, underscores, dots
const CONFIG_MAP_KEY_REGEX = /^[-._a-zA-Z0-9]+$/;

export const SecretsCreateModal: React.FC<SecretsCreateModalProps> = ({
  isOpen,
  setIsOpen,
  onSecretCreated,
  existingSecretNames = [],
  secretToEdit,
  onSecretUpdated,
}) => {
  const { api } = useNotebookAPI();
  const { selectedNamespace } = useNamespaceSelectorWrapper();

  const isEditMode = !!secretToEdit;

  const [secretName, setSecretName] = useState('');
  const [keyValuePairs, setKeyValuePairs] = useState<SecretKeyValuePair[]>([EMPTY_KEY_VALUE_PAIR]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [immutable, setImmutable] = useState(false);

  const [secretContents, isSecretContentsLoaded, secretContentsError] = useSecretContents({
    isOpen,
    secretName: secretToEdit?.name,
  });

  // Set form fields when editing a secret
  useEffect(() => {
    if (isOpen && secretToEdit) {
      setSecretName(secretToEdit.name);
      setImmutable(secretToEdit.immutable);
    }
  }, [isOpen, secretToEdit]);

  // Sync fetched secret contents to form state
  useEffect(() => {
    if (isSecretContentsLoaded && secretContents.length > 0) {
      setKeyValuePairs(secretContents);
    }
  }, [isSecretContentsLoaded, secretContents]);

  // Set error from secret contents fetch
  useEffect(() => {
    if (secretContentsError) {
      setError('Failed to load secret contents');
    }
  }, [secretContentsError]);

  const validateSecretName = useCallback(
    (name: string): string | null => {
      if (!name) {
        return 'Secret name is required';
      }
      if (name.length < 2) {
        return 'Secret name must be at least 2 characters';
      }
      if (name.length > 63) {
        return 'Secret name must be at most 63 characters';
      }
      if (!SECRET_NAME_REGEX.test(name)) {
        return 'Secret name must consist of lower case alphanumeric characters, hyphens, or dots, and must start and end with an alphanumeric character';
      }
      // Skip duplicate check in edit mode (the secret's own name is expected to exist)
      if (!isEditMode && existingSecretNames.includes(name)) {
        return 'A secret with this name is already attached to this workspace';
      }
      return null;
    },
    [existingSecretNames, isEditMode],
  );

  const validateKey = useCallback((key: string): string | null => {
    if (!key) {
      return 'Key is required';
    }
    if (!CONFIG_MAP_KEY_REGEX.test(key)) {
      return 'Key must consist of alphanumeric characters, hyphens, underscores, or dots';
    }
    return null;
  }, []);

  const validateForm = useCallback((): string | null => {
    const nameError = validateSecretName(secretName);
    if (nameError) {
      return nameError;
    }

    const seenKeys = new Set<string>();
    for (let i = 0; i < keyValuePairs.length; i++) {
      const pair = keyValuePairs[i];
      const keyError = validateKey(pair.key);
      if (keyError) {
        return `${keyError} (pair ${i + 1})`;
      }
      if (!pair.value) {
        return `Value is required (pair ${i + 1})`;
      }
      if (seenKeys.has(pair.key)) {
        return 'Duplicate keys are not allowed';
      }
      seenKeys.add(pair.key);
    }

    return null;
  }, [secretName, keyValuePairs, validateSecretName, validateKey]);

  const resetForm = useCallback(() => {
    setSecretName('');
    setKeyValuePairs([EMPTY_KEY_VALUE_PAIR]);
    setImmutable(false);
    setError(null);
  }, []);

  const buildContentsPayload = useCallback(() => {
    const contents: Record<string, { base64?: string }> = {};
    keyValuePairs.forEach((pair) => {
      contents[pair.key] = { base64: btoa(pair.value) };
    });
    return contents;
  }, [keyValuePairs]);

  const handleSubmit = useCallback(async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const contents = buildContentsPayload();
      const currentSecretName = secretName;

      if (isEditMode) {
        await api.secrets.updateSecret(selectedNamespace, secretName, {
          type: 'Opaque',
          immutable,
          contents,
        });
        resetForm();
        setIsOpen(false);
        onSecretUpdated?.(currentSecretName);
      } else {
        await api.secrets.createSecret(selectedNamespace, {
          data: {
            name: secretName,
            type: 'Opaque',
            immutable,
            contents,
          },
        });
        resetForm();
        setIsOpen(false);
        onSecretCreated?.(currentSecretName);
      }
    } catch (err) {
      const action = isEditMode ? 'update' : 'create';
      setError(
        err instanceof Error ? err.message : `Failed to ${action} secret. Please try again.`,
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    validateForm,
    buildContentsPayload,
    secretName,
    isEditMode,
    api.secrets,
    selectedNamespace,
    immutable,
    resetForm,
    setIsOpen,
    onSecretUpdated,
    onSecretCreated,
  ]);

  const handleClose = useCallback(() => {
    resetForm();
    setIsOpen(false);
  }, [resetForm, setIsOpen]);

  const { isMUITheme } = useThemeContext();

  const modalTitle = isEditMode ? 'Edit Secret' : 'Attach New Secret';
  const submitButtonText = isEditMode ? 'Save' : 'Attach';

  return (
    <Modal
      variant={ModalVariant.large}
      isOpen={isOpen}
      onClose={handleClose}
      aria-labelledby="create-secret-modal-title"
      data-testid="secrets-modal"
    >
      <ModalHeader title={modalTitle} labelId="create-secret-modal-title" />
      <ModalBody>
        {error && (
          <Alert variant={AlertVariant.danger} isInline title="Error" data-testid="error-alert">
            {error}
          </Alert>
        )}
        {isEditMode && !isSecretContentsLoaded && !secretContentsError && (
          <Alert variant={AlertVariant.info} isInline title="Loading">
            Loading secret data...
          </Alert>
        )}
        <Form>
          <ThemeAwareFormGroupWrapper
            label="Secret name"
            isRequired
            fieldId="secret-name"
            helperTextNode={
              !isEditMode && (
                <HelperText>
                  Must start and end with a letter or number. Valid characters include lowercase
                  letters, numbers, and hyphens (-).
                </HelperText>
              )
            }
          >
            <TextInput
              id="secret-name"
              data-testid="secret-name-input"
              isRequired
              value={secretName}
              onChange={(_event, value) => setSecretName(value)}
              aria-label="Secret name"
              isDisabled={isEditMode}
            />
          </ThemeAwareFormGroupWrapper>

          {/* Show permissions info when editing */}
          {isEditMode && (
            <LabelGroup categoryName="Permissions">
              <Label color={secretToEdit.canMount ? 'blue' : 'grey'} data-testid="can-mount-label">
                {secretToEdit.canMount ? 'Can mount' : 'Cannot mount'}
              </Label>
              <Label
                color={secretToEdit.canUpdate ? 'blue' : 'grey'}
                data-testid="can-update-label"
              >
                {secretToEdit.canUpdate ? 'Can update' : 'Cannot update'}
              </Label>
            </LabelGroup>
          )}

          {/* Immutable toggle */}
          <FormGroup fieldId="secret-immutable">
            <Switch
              id="secret-immutable"
              data-testid="secret-immutable-switch"
              label={
                <div>
                  <div>Immutable</div>
                  <HelperText>
                    When enabled, the secret cannot be modified after creation.
                  </HelperText>
                </div>
              }
              isChecked={immutable}
              onChange={(_event, checked) => setImmutable(checked)}
              isDisabled={isEditMode && secretToEdit.immutable}
            />
          </FormGroup>
          <ThemeAwareFormGroupWrapper label="Secret type" isRequired fieldId="secret-type">
            <Select
              selected="Opaque"
              toggle={(toggleRef) => (
                <MenuToggle
                  isFullWidth
                  // Remove className and style from the toggle once https://github.com/opendatahub-io/mod-arch-library/issues/65 is fixed
                  className={isMUITheme ? 'pf-v6-u-pl-md pf-v6-u-pr-md' : ''}
                  style={{
                    ...(isMUITheme
                      ? {
                          height: '56px',
                        }
                      : {}),
                  }}
                  ref={toggleRef}
                  id="secret-type-toggle"
                  isExpanded={false}
                  isDisabled
                  data-testid="secret-type-select"
                >
                  Opaque
                </MenuToggle>
              )}
            />
          </ThemeAwareFormGroupWrapper>
          <EditableRowsTable
            rows={keyValuePairs}
            setRows={setKeyValuePairs}
            title="Secret data"
            description="Key/value pairs stored in the secret."
            buttonLabel="key-value pair"
            valueInputType="password"
            addButtonTestId="another-key-value-pair-button"
            isExpanded
            minRows={1}
          />
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button
          key="submit"
          variant="primary"
          onClick={handleSubmit}
          isLoading={isSubmitting}
          isDisabled={
            isSubmitting ||
            (isEditMode && !isSecretContentsLoaded) ||
            (isEditMode && secretToEdit.immutable) ||
            (isEditMode && !secretToEdit.canUpdate)
          }
          data-testid="secret-modal-submit-button"
        >
          {submitButtonText}
        </Button>
        <Button
          key="cancel"
          variant="link"
          onClick={handleClose}
          isDisabled={isSubmitting}
          data-testid="secret-modal-cancel-button"
        >
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default SecretsCreateModal;
