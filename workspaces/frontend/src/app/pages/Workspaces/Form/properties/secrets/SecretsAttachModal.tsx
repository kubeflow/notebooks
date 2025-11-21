import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
} from '@patternfly/react-core/dist/esm/components/Modal';
import { MultiTypeaheadSelect, MultiTypeaheadSelectOption } from '@patternfly/react-templates';
import { Form } from '@patternfly/react-core/dist/esm/components/Form';
import { HelperText, HelperTextItem } from '@patternfly/react-core/dist/esm/components/HelperText';
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput';
import { ValidatedOptions } from '@patternfly/react-core/helpers';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { Tooltip } from '@patternfly/react-core/dist/esm/components/Tooltip';
import { InfoCircleIcon } from '@patternfly/react-icons/dist/esm/icons/info-circle-icon';
import { Truncate } from '@patternfly/react-core/dist/esm/components/Truncate';
import { Stack, StackItem } from '@patternfly/react-core/dist/esm/layouts/Stack';
import { SecretsSecretListItem } from '~/generated/data-contracts';
import { isValidDefaultMode } from '~/app/pages/Workspaces/Form/helpers';
import ThemeAwareFormGroupWrapper from '~/shared/components/ThemeAwareFormGroupWrapper';

export interface SecretsAttachModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onClose: (secrets: SecretsSecretListItem[], mountPath: string, mode: number) => void;
  availableSecrets: SecretsSecretListItem[];
  existingSecretKeys: Set<string>;
}

const DEFAULT_MODE_OCTAL = (420).toString(8);

export const SecretsAttachModal: React.FC<SecretsAttachModalProps> = ({
  isOpen,
  setIsOpen,
  onClose,
  availableSecrets,
  existingSecretKeys,
}) => {
  const [selected, setSelected] = useState<string[]>([]);
  const [mountPath, setMountPath] = useState('');
  const [defaultMode, setDefaultMode] = useState(DEFAULT_MODE_OCTAL);
  const [isDefaultModeValid, setIsDefaultModeValid] = useState(true);
  const [error, setError] = useState<string>('');

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelected([]);
      setMountPath('');
      setDefaultMode(DEFAULT_MODE_OCTAL);
      setIsDefaultModeValid(true);
      setError('');
    }
  }, [isOpen]);

  const getSecretKey = (secretName: string, path: string, mode: number): string =>
    `${secretName}:${path}:${mode}`;

  const handleDefaultModeChange = (val: string) => {
    if (val.length <= 3) {
      setDefaultMode(val);
      const isValid = isValidDefaultMode(val);
      setIsDefaultModeValid(val.length === 3 && isValid);
      setError(''); // Clear error when user modifies input
    }
  };

  const handleAttach = () => {
    const mode = parseInt(defaultMode, 8);

    // Check for duplicates
    const duplicates: string[] = [];
    selected.forEach((secretName) => {
      const key = getSecretKey(secretName, mountPath.trim(), mode);
      if (existingSecretKeys.has(key)) {
        duplicates.push(secretName);
      }
    });

    if (duplicates.length > 0) {
      const secretList = duplicates.join(', ');
      setError(
        `The following secret${duplicates.length > 1 ? 's are' : ' is'} already mounted to "${mountPath.trim()}" with mode ${defaultMode}: ${secretList}`,
      );
      return;
    }

    // No duplicates, proceed with attaching
    onClose(
      availableSecrets.filter((secret) => selected.includes(secret.name)),
      mountPath.trim(),
      mode,
    );
  };

  const initialOptions = useMemo<MultiTypeaheadSelectOption[]>(
    () =>
      availableSecrets.map((secret) => ({
        content: secret.name,
        value: secret.name,
        isDisabled: !secret.canMount,
        description: (
          // <Grid style={{ maxWidth: '45vw' }}>
          <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }}>
            <FlexItem style={{ maxWidth: '35vw' }}>
              <Stack>
                <StackItem>
                  Type: {secret.type}
                  {secret.immutable && '. Immutable'}
                </StackItem>
                {secret.mounts && (
                  <StackItem>
                    {`Mounted to: `}
                    <Truncate
                      content={secret.mounts.map((mount) => mount.name).join(', ')}
                      position="middle"
                    />
                  </StackItem>
                )}
              </Stack>
            </FlexItem>
            <FlexItem>
              {secret.canMount && (
                <Tooltip
                  aria="none"
                  aria-live="polite"
                  content=<Stack>
                    <StackItem>
                      Created at: {new Date(secret.audit.createdAt).toLocaleString()} {`by `}
                      {secret.audit.createdBy}
                    </StackItem>
                    <StackItem>
                      Updated at: {new Date(secret.audit.updatedAt).toLocaleString()} {`by `}
                      {secret.audit.updatedBy}
                    </StackItem>
                  </Stack>
                >
                  <Button
                    aria-label="Show secret details"
                    variant="plain"
                    id="tt-ref"
                    icon={<InfoCircleIcon />}
                  />
                </Tooltip>
              )}
            </FlexItem>
          </Flex>
          // </Grid>
        ),
      })),
    [availableSecrets],
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      ouiaId="BasicModal"
      aria-labelledby="basic-modal-title"
      aria-describedby="modal-box-body-basic"
      variant={ModalVariant.medium}
    >
      <ModalHeader title="Attach Existing Secrets" labelId="basic-modal-title" />
      <ModalBody id="modal-box-body-basic">
        <Form>
          <ThemeAwareFormGroupWrapper label="Secret" fieldId="secret-select">
            <MultiTypeaheadSelect
              initialOptions={initialOptions}
              id="secret-select"
              placeholder="Select a secret"
              noOptionsFoundMessage={(filter) => `No secret was found for "${filter}"`}
              onSelectionChange={(_ev, selections) => {
                setSelected(selections as string[]);
                setError('');
              }}
            />
          </ThemeAwareFormGroupWrapper>
          <ThemeAwareFormGroupWrapper label="Mount Path" isRequired fieldId="mount-path">
            <TextInput
              name="mountPath"
              isRequired
              type="text"
              value={mountPath}
              onChange={(_, val) => {
                setMountPath(val);
                setError('');
              }}
              id="mount-path"
            />
          </ThemeAwareFormGroupWrapper>
          <ThemeAwareFormGroupWrapper label="Default Mode" isRequired fieldId="default-mode">
            <TextInput
              name="defaultMode"
              isRequired
              type="text"
              value={defaultMode}
              validated={!isDefaultModeValid ? ValidatedOptions.error : undefined}
              onChange={(_, val) => handleDefaultModeChange(val)}
              id="default-mode"
            />
            {!isDefaultModeValid && (
              <HelperText>
                <HelperTextItem variant="error">
                  Must be a valid UNIX file system permission value (i.e. 644)
                </HelperTextItem>
              </HelperText>
            )}
          </ThemeAwareFormGroupWrapper>
        </Form>
        {error && (
          <HelperText>
            <HelperTextItem variant="error">{error}</HelperTextItem>
          </HelperText>
        )}
      </ModalBody>
      <ModalFooter>
        <Button
          key="attach"
          variant="primary"
          isDisabled={!isDefaultModeValid || !mountPath || selected.length === 0}
          onClick={handleAttach}
        >
          Attach
        </Button>
        <Button key="cancel" variant="link" onClick={() => setIsOpen(false)}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
