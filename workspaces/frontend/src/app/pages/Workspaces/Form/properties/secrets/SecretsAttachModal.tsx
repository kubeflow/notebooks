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
import { TypeaheadSelect, TypeaheadSelectOption } from '@patternfly/react-templates';
import { Form, FormGroup } from '@patternfly/react-core/dist/esm/components/Form';
import { HelperText, HelperTextItem } from '@patternfly/react-core/dist/esm/components/HelperText';
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput';
import { ValidatedOptions } from '@patternfly/react-core/helpers';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { Label, LabelGroup } from '@patternfly/react-core/dist/esm/components/Label';
import { Tooltip } from '@patternfly/react-core/dist/esm/components/Tooltip';
import { ActionList, ActionListItem } from '@patternfly/react-core/dist/esm/components/ActionList';
import { InfoCircleIcon } from '@patternfly/react-icons/dist/esm/icons/info-circle-icon';
import { WrenchIcon } from '@patternfly/react-icons/dist/esm/icons/wrench-icon';
import { PencilAltIcon } from '@patternfly/react-icons/dist/esm/icons/pencil-alt-icon';
import { CheckIcon } from '@patternfly/react-icons/dist/esm/icons/check-icon';
import { TimesIcon } from '@patternfly/react-icons/dist/esm/icons/times-icon';
import { InputGroup, InputGroupItem } from '@patternfly/react-core/dist/esm/components/InputGroup';
import { Stack, StackItem } from '@patternfly/react-core/dist/esm/layouts/Stack';
import { useThemeContext } from 'mod-arch-kubeflow';
import { SecretsSecretListItem } from '~/generated/data-contracts';
import {
  isValidDefaultMode,
  DEFAULT_MODE_OCTAL,
  normalizeMountPath,
  validateMountPath,
  getMountPathUniquenessError,
  getMountPathValidationErrorForPaths,
} from '~/app/pages/Workspaces/Form/helpers';
import ThemeAwareFormGroupWrapper from '~/shared/components/ThemeAwareFormGroupWrapper';
import { LabelGroupWithTooltip } from '~/app/components/LabelGroupWithTooltip';

const SECRET_SELECT_EMPTY_KEY = 'secret-select-empty';

export interface SecretsAttachModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onAttach: (secrets: SecretsSecretListItem[], mountPath: string, mode: number) => void;
  availableSecrets: SecretsSecretListItem[];
  mountedKeys: Set<string>;
  existingMountPaths: string[];
}

export const SecretsAttachModal: React.FC<SecretsAttachModalProps> = ({
  isOpen,
  setIsOpen,
  onAttach,
  availableSecrets,
  mountedKeys,
  existingMountPaths,
}) => {
  const { isMUITheme } = useThemeContext();
  const [selected, setSelected] = useState<string | null>(null);
  const [mountPath, setMountPath] = useState('/secrets/');
  const [defaultMode, setDefaultMode] = useState(DEFAULT_MODE_OCTAL);
  const [isDefaultModeValid, setIsDefaultModeValid] = useState(true);
  const [isMountPathEditing, setIsMountPathEditing] = useState(false);
  const [error, setError] = useState<string>('');

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelected(null);
      setMountPath('/secrets/');
      setDefaultMode(DEFAULT_MODE_OCTAL);
      setIsDefaultModeValid(true);
      setIsMountPathEditing(false);
      setError('');
    }
  }, [isOpen]);

  // Auto-fill mount path when secret is selected
  useEffect(() => {
    if (selected) {
      setMountPath(`/secrets/${selected}`);
      setIsMountPathEditing(false);
    }
  }, [selected]);

  const mountPathFormatError = isMountPathEditing ? validateMountPath(mountPath) : null;
  const mountPathUniquenessError = !mountPathFormatError
    ? getMountPathUniquenessError(existingMountPaths, mountPath)
    : null;
  const mountPathError = mountPathFormatError ?? mountPathUniquenessError;
  const isMountPathValid = !mountPathError;

  const handleStartMountPathEdit = useCallback(() => {
    setIsMountPathEditing(true);
    setError('');
  }, []);

  const handleConfirmMountPathEdit = useCallback(() => {
    const err = getMountPathValidationErrorForPaths(existingMountPaths, mountPath);
    if (err) {
      return;
    }
    setIsMountPathEditing(false);
  }, [existingMountPaths, mountPath]);

  const handleCancelMountPathEdit = useCallback(() => {
    if (selected) {
      setMountPath(`/secrets/${selected}`);
    } else {
      setMountPath('/secrets/');
    }
    setIsMountPathEditing(false);
  }, [selected]);

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
    if (!selected) {
      return;
    }

    const mode = parseInt(defaultMode, 8);
    const trimmedMountPath = normalizeMountPath(mountPath);
    const key = getSecretKey(selected, trimmedMountPath);

    if (mountedKeys.has(key)) {
      setError(`The secret "${selected}" is already mounted to "${trimmedMountPath}"`);
      return;
    }

    const uniquenessErr = getMountPathUniquenessError(existingMountPaths, mountPath);
    if (uniquenessErr) {
      setError(uniquenessErr);
      return;
    }

    const secretToAttach = availableSecrets.find((secret) => secret.name === selected);
    if (secretToAttach) {
      onAttach([secretToAttach], trimmedMountPath, mode);
    }
  }, [
    getSecretKey,
    mountedKeys,
    existingMountPaths,
    mountPath,
    selected,
    availableSecrets,
    onAttach,
    defaultMode,
  ]);

  const initialOptions = useMemo<TypeaheadSelectOption[]>(
    () =>
      availableSecrets.map((secret) => ({
        content: secret.name,
        value: secret.name,
        isDisabled: !secret.canMount,
        selected: secret.name === selected,
        description: (
          <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }}>
            <FlexItem>
              <Stack>
                <StackItem>
                  <LabelGroup>
                    <Label isCompact>Type: {secret.type}</Label>
                    {secret.immutable && (
                      <Label color="orange" isCompact>
                        Immutable
                      </Label>
                    )}
                    {!secret.canMount && <Label isCompact>Unmountable</Label>}
                  </LabelGroup>
                </StackItem>
                {secret.mounts && (
                  <StackItem className="pf-v6-u-ml-sm pf-v6-u-mt-xs">
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
    [availableSecrets, selected],
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      ouiaId="BasicModal"
      aria-labelledby="basic-modal-title"
      aria-describedby="modal-box-body-basic"
      variant={ModalVariant.large}
    >
      <ModalHeader title="Attach Existing Secrets" labelId="basic-modal-title" />
      <ModalBody id="modal-box-body-basic">
        {error && (
          <Alert variant={AlertVariant.danger} isInline title="Error">
            {error}
          </Alert>
        )}
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            handleAttach();
          }}
        >
          <ThemeAwareFormGroupWrapper label="Secret" fieldId="secret-select">
            <TypeaheadSelect
              key={selected ?? SECRET_SELECT_EMPTY_KEY}
              initialOptions={initialOptions}
              id="secret-select"
              placeholder="Select a secret"
              isScrollable
              maxMenuHeight="15rem"
              noOptionsFoundMessage={(filter) => `No secret was found for "${filter}"`}
              onSelect={(_ev, selection) => {
                setSelected(selection as string);
                setError('');
              }}
              onClearSelection={() => {
                setSelected(null);
                setError('');
              }}
            />
          </ThemeAwareFormGroupWrapper>
          {isMUITheme ? (
            <ThemeAwareFormGroupWrapper
              label="Mount Path"
              isRequired
              fieldId="mount-path"
              hasError={!!mountPathError}
              className={!isMountPathEditing ? 'mount-path-readonly' : ''}
              helperTextNode={
                mountPathError ? (
                  <HelperText>
                    <HelperTextItem variant="error">{mountPathError}</HelperTextItem>
                  </HelperText>
                ) : null
              }
            >
              {isMountPathEditing ? (
                <InputGroup>
                  <InputGroupItem isFill>
                    <TextInput
                      id="mount-path"
                      name="mountPath"
                      isRequired
                      type="text"
                      value={mountPath}
                      validated={mountPathError ? ValidatedOptions.error : undefined}
                      onChange={(_, val) => {
                        setMountPath(val);
                        setError('');
                      }}
                      aria-label="Edit mount path"
                      data-testid="mount-path-input"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleConfirmMountPathEdit();
                        } else if (e.key === 'Escape') {
                          handleCancelMountPathEdit();
                        }
                      }}
                    />
                  </InputGroupItem>
                  <InputGroupItem>
                    <Button
                      variant="control"
                      aria-label="Save mount path"
                      onClick={handleConfirmMountPathEdit}
                      isDisabled={!!mountPathError}
                      data-testid="mount-path-save"
                    >
                      <CheckIcon />
                    </Button>
                  </InputGroupItem>
                  <InputGroupItem>
                    <Button
                      variant="control"
                      aria-label="Cancel edit"
                      onClick={handleCancelMountPathEdit}
                      data-testid="mount-path-cancel"
                    >
                      <TimesIcon />
                    </Button>
                  </InputGroupItem>
                </InputGroup>
              ) : (
                <InputGroup>
                  <InputGroupItem isFill>
                    <TextInput
                      id="mount-path"
                      name="mountPath"
                      isRequired
                      readOnly
                      type="text"
                      value={mountPath}
                      validated={mountPathError ? ValidatedOptions.error : undefined}
                      aria-label="Mount path"
                      data-testid="mount-path-input"
                    />
                  </InputGroupItem>
                  <InputGroupItem>
                    <Button
                      variant="control"
                      aria-label="Edit mount path"
                      onClick={handleStartMountPathEdit}
                      data-testid="mount-path-edit"
                    >
                      <PencilAltIcon />
                    </Button>
                  </InputGroupItem>
                </InputGroup>
              )}
            </ThemeAwareFormGroupWrapper>
          ) : (
            <FormGroup
              fieldId={isMountPathEditing ? 'mount-path' : 'mount-path-display'}
              label="Mount Path"
              isRequired
              labelHelp={
                isMountPathEditing ? (
                  <Button
                    variant="plain"
                    aria-hidden
                    tabIndex={-1}
                    style={{ visibility: 'hidden' }}
                  >
                    <PencilAltIcon />
                  </Button>
                ) : (
                  <Tooltip content="Edit mount path">
                    <Button
                      variant="plain"
                      aria-label="Edit mount path"
                      onClick={handleStartMountPathEdit}
                      data-testid="mount-path-edit"
                    >
                      <PencilAltIcon />
                    </Button>
                  </Tooltip>
                )
              }
            >
              {isMountPathEditing ? (
                <>
                  <Flex>
                    <FlexItem grow={{ default: 'grow' }}>
                      <TextInput
                        id="mount-path"
                        name="mountPath"
                        isRequired
                        type="text"
                        value={mountPath}
                        validated={mountPathError ? ValidatedOptions.error : undefined}
                        onChange={(_, val) => {
                          setMountPath(val);
                          setError('');
                        }}
                        aria-label="Edit mount path"
                        data-testid="mount-path-input"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleConfirmMountPathEdit();
                          } else if (e.key === 'Escape') {
                            handleCancelMountPathEdit();
                          }
                        }}
                      />
                    </FlexItem>
                    <FlexItem>
                      <ActionList isIconList>
                        <ActionListItem>
                          <Button
                            variant="link"
                            icon={<CheckIcon />}
                            aria-label="Save mount path"
                            onClick={handleConfirmMountPathEdit}
                            isDisabled={!!mountPathError}
                            data-testid="mount-path-save"
                          />
                        </ActionListItem>
                        <ActionListItem>
                          <Button
                            variant="plain"
                            icon={<TimesIcon />}
                            aria-label="Cancel edit"
                            onClick={handleCancelMountPathEdit}
                            data-testid="mount-path-cancel"
                          />
                        </ActionListItem>
                      </ActionList>
                    </FlexItem>
                  </Flex>
                  {mountPathError && (
                    <HelperText>
                      <HelperTextItem variant="error">{mountPathError}</HelperTextItem>
                    </HelperText>
                  )}
                </>
              ) : (
                <span data-testid="mount-path-text">{mountPath}</span>
              )}
            </FormGroup>
          )}
          <ThemeAwareFormGroupWrapper label="Default Mode" isRequired fieldId="default-mode">
            <FormGroup fieldId="default-mode" isRequired>
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
            </FormGroup>
          </ThemeAwareFormGroupWrapper>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button
          key="attach"
          variant="primary"
          isDisabled={!isDefaultModeValid || !isMountPathValid || !mountPath || !selected}
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
