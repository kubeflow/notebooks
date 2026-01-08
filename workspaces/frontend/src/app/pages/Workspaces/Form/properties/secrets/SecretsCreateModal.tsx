import React, { useCallback, useState } from 'react';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { Divider } from '@patternfly/react-core/dist/esm/components/Divider';
import { Form } from '@patternfly/react-core/dist/esm/components/Form';
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput';
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
import { PlusCircleIcon } from '@patternfly/react-icons/dist/esm/icons/plus-circle-icon';
import { useThemeContext } from 'mod-arch-kubeflow';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { useNamespaceContext } from '~/app/context/NamespaceContextProvider';
import ThemeAwareFormGroupWrapper from '~/shared/components/ThemeAwareFormGroupWrapper';
import SecretKeyValuePairInput from './SecretKeyValuePairInput';

interface SecretKeyValuePair {
  key: string;
  value: string;
}

interface SecretsCreateModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSecretCreated?: (secretName: string) => void;
  existingSecretNames?: string[];
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
}) => {
  const { api } = useNotebookAPI();
  const { selectedNamespace } = useNamespaceContext();

  const [secretName, setSecretName] = useState('');
  const [keyValuePairs, setKeyValuePairs] = useState<SecretKeyValuePair[]>([EMPTY_KEY_VALUE_PAIR]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateSecretName = useCallback(
    (name: string): string | null => {
      if (!name) {
        return 'Secret name is required';
      }
      if (name.length > 253) {
        return 'Secret name must be at most 253 characters';
      }
      if (!SECRET_NAME_REGEX.test(name)) {
        return 'Secret name must consist of lower case alphanumeric characters, hyphens, or dots, and must start and end with an alphanumeric character';
      }
      if (existingSecretNames.includes(name)) {
        return 'A secret with this name is already attached to this workspace';
      }
      return null;
    },
    [existingSecretNames],
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

  const updateArrayValue = useCallback(
    (index: number, updates: Partial<SecretKeyValuePair>) => {
      const updated = [...keyValuePairs];
      updated[index] = { ...updated[index], ...updates };
      setKeyValuePairs(updated);
    },
    [keyValuePairs],
  );

  const removeArrayItem = useCallback(
    (index: number) => {
      setKeyValuePairs(keyValuePairs.filter((_, i) => i !== index));
    },
    [keyValuePairs],
  );

  const handleAddKeyValuePair = useCallback(() => {
    setKeyValuePairs([...keyValuePairs, EMPTY_KEY_VALUE_PAIR]);
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
      // Convert key-value pairs to the API format with base64 encoding
      const contents: Record<string, { base64?: string }> = {};
      keyValuePairs.forEach((pair) => {
        // Base64 encode the value
        const base64Value = btoa(pair.value);
        contents[pair.key] = { base64: base64Value };
      });

      const payload = {
        data: {
          name: secretName,
          type: 'Opaque',
          immutable: false,
          contents,
        },
      };

      await api.secrets.createSecret(selectedNamespace, payload);

      // Reset form
      const createdSecretName = secretName;
      setSecretName('');
      setKeyValuePairs([EMPTY_KEY_VALUE_PAIR]);
      setIsOpen(false);

      // Notify parent with the created secret name
      if (onSecretCreated) {
        onSecretCreated(createdSecretName);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create secret. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    validateForm,
    keyValuePairs,
    api.secrets,
    selectedNamespace,
    secretName,
    setIsOpen,
    onSecretCreated,
  ]);

  const handleClose = useCallback(() => {
    setSecretName('');
    setKeyValuePairs([EMPTY_KEY_VALUE_PAIR]);
    setError(null);
    setIsOpen(false);
  }, [setIsOpen]);

  const { isMUITheme } = useThemeContext();

  return (
    <Modal
      variant={ModalVariant.medium}
      isOpen={isOpen}
      onClose={handleClose}
      aria-labelledby="create-secret-modal-title"
    >
      <ModalHeader title="Create Secret" labelId="create-secret-modal-title" />
      <ModalBody>
        {error && (
          <Alert variant={AlertVariant.danger} isInline title="Error">
            {error}
          </Alert>
        )}
        <Form>
          <ThemeAwareFormGroupWrapper
            label="Secret name"
            isRequired
            fieldId="secret-name"
            helperTextNode={
              <HelperText>
                Must start and end with a letter or number. Valid characters include lowercase
                letters, numbers, and hyphens (-).
              </HelperText>
            }
          >
            <TextInput
              id="secret-name"
              data-testid="secret-name-input"
              isRequired
              value={secretName}
              onChange={(_event, value) => setSecretName(value)}
              aria-label="Secret name"
            />
          </ThemeAwareFormGroupWrapper>
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
          {keyValuePairs.map(({ key, value }, i) => (
            <React.Fragment key={i}>
              <SecretKeyValuePairInput
                index={i}
                keyValue={key}
                valueValue={value}
                onKeyChange={(updatedKey) => updateArrayValue(i, { key: updatedKey })}
                onValueChange={(updatedValue) => updateArrayValue(i, { value: updatedValue })}
                onRemove={() => removeArrayItem(i)}
                canRemove={keyValuePairs.length > 1}
              />
              {i !== keyValuePairs.length - 1 && (
                <Divider className={isMUITheme ? 'pf-v6-u-mt-md' : ''} />
              )}
            </React.Fragment>
          ))}
          <Button
            variant="link"
            data-testid="another-key-value-pair-button"
            isInline
            icon={<PlusCircleIcon />}
            className={isMUITheme ? 'pf-v6-u-mt-md' : ''}
            iconPosition="left"
            onClick={handleAddKeyValuePair}
          >
            Add another key / value pair
          </Button>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button
          key="create"
          variant="primary"
          onClick={handleSubmit}
          isLoading={isSubmitting}
          isDisabled={isSubmitting}
        >
          Create
        </Button>
        <Button key="cancel" variant="link" onClick={handleClose} isDisabled={isSubmitting}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default SecretsCreateModal;
