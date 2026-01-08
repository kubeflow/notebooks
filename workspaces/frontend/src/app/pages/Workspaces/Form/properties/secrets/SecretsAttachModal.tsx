import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
} from '@patternfly/react-core/dist/esm/components/Modal';
import { Alert, AlertVariant } from '@patternfly/react-core/dist/esm/components/Alert';
import { MultiTypeaheadSelect, MultiTypeaheadSelectOption } from '@patternfly/react-templates';
import { Form } from '@patternfly/react-core/dist/esm/components/Form';
import { HelperText, HelperTextItem } from '@patternfly/react-core/dist/esm/components/HelperText';
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput';
import { ValidatedOptions } from '@patternfly/react-core/helpers';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { Label, LabelGroup } from '@patternfly/react-core/dist/esm/components/Label';
import { Tooltip } from '@patternfly/react-core/dist/esm/components/Tooltip';
import { InfoCircleIcon } from '@patternfly/react-icons/dist/esm/icons/info-circle-icon';
import { WrenchIcon } from '@patternfly/react-icons/dist/esm/icons/wrench-icon';
import { Stack, StackItem } from '@patternfly/react-core/dist/esm/layouts/Stack';
import { SecretsSecretListItem } from '~/generated/data-contracts';
import { isValidDefaultMode } from '~/app/pages/Workspaces/Form/helpers';
import ThemeAwareFormGroupWrapper from '~/shared/components/ThemeAwareFormGroupWrapper';
import { LabelGroupWithTooltip } from '~/app/components/LabelGroupWithTooltip';

export interface SecretsAttachModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onAttach: (secrets: SecretsSecretListItem[], mountPath: string, mode: number) => void;
  availableSecrets: SecretsSecretListItem[];
  existingSecretKeys: Set<string>;
}

const DEFAULT_MODE_OCTAL = (420).toString(8);

export const SecretsAttachModal: React.FC<SecretsAttachModalProps> = ({
  isOpen,
  setIsOpen,
  onAttach,
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

  const getSecretKey = useCallback(
    (secretName: string, path: string): string => `${secretName}:${path}`,
    [],
  );

  const handleDefaultModeChange = useCallback((val: string) => {
    if (val.length <= 3) {
      setDefaultMode(val);
      const isValid = isValidDefaultMode(val);
      setIsDefaultModeValid(val.length === 3 && isValid);
      setError(''); // Clear error when user modifies input
    }
  }, []);

  const handleAttach = useCallback(() => {
    const mode = parseInt(defaultMode, 8);

    // Check for duplicates
    const duplicates: string[] = [];
    // Handle trailing slashes in mount path
    const trimmedMountPath = mountPath.trim().replace(/\/+$/, '');
    selected.forEach((secretName) => {
      const key = getSecretKey(secretName, trimmedMountPath);
      if (existingSecretKeys.has(key)) {
        duplicates.push(secretName);
      }
    });

    if (duplicates.length > 0) {
      const secretList = duplicates.join(', ');
      setError(
        `The following secret${duplicates.length > 1 ? 's are' : ' is'} already mounted to "${mountPath.trim()}": ${secretList}`,
      );
      return;
    }

    // No duplicates, proceed with attaching
    onAttach(
      availableSecrets.filter((secret) => selected.includes(secret.name)),
      trimmedMountPath,
      mode,
    );
  }, [
    getSecretKey,
    existingSecretKeys,
    mountPath,
    selected,
    availableSecrets,
    onAttach,
    defaultMode,
  ]);

  const initialOptions = useMemo<MultiTypeaheadSelectOption[]>(
    () =>
      availableSecrets.map((secret) => ({
        content: secret.name,
        value: secret.name,
        isDisabled: !secret.canMount,
        description: (
          <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }}>
            <FlexItem>
              <Stack>
                <StackItem>
                  <LabelGroup>
                    <Label isCompact>Type: {secret.type}</Label>
                    {secret.immutable && <Label isCompact>Immutable</Label>}
                    {!secret.canMount && <Label isCompact>Unmountable</Label>}
                  </LabelGroup>
                </StackItem>
                {secret.mounts && (
                  <StackItem style={{ marginLeft: '1.25ch', marginTop: '0.25rem' }}>
                    <Flex gap={{ default: 'gapXs' }}>
                      <FlexItem>Mounted to:</FlexItem>
                      <FlexItem>
                        <LabelGroupWithTooltip
                          labels={secret.mounts.map((mount) => mount.name)}
                          limit={5}
                          variant="outline"
                          icon={<WrenchIcon color="teal" />}
                          isCompact
                          color="teal"
                        />
                      </FlexItem>
                    </Flex>
                  </StackItem>
                )}
              </Stack>
            </FlexItem>
            <FlexItem>
              <Tooltip
                aria="none"
                aria-live="polite"
                content={
                  <Stack>
                    <StackItem>
                      {`Created at: ${new Date(secret.audit.createdAt).toLocaleString()} by 
                        ${secret.audit.createdBy}`}
                    </StackItem>
                    <StackItem>
                      {`Updated at: ${new Date(secret.audit.updatedAt).toLocaleString()} by 
                        ${secret.audit.updatedBy}`}
                    </StackItem>
                  </Stack>
                }
              >
                <InfoCircleIcon />
              </Tooltip>
            </FlexItem>
          </Flex>
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
        {error && (
          <Alert variant={AlertVariant.danger} isInline title="Error">
            {error}
          </Alert>
        )}
        <Form>
          <ThemeAwareFormGroupWrapper label="Secret" fieldId="secret-select">
            <MultiTypeaheadSelect
              initialOptions={initialOptions}
              menuHeight="15rem"
              isScrollable
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
