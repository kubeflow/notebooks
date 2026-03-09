import React, { useCallback, useEffect, useState } from 'react';
import { Alert, AlertVariant } from '@patternfly/react-core/dist/esm/components/Alert';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import {
  Form,
  FormFieldGroupExpandable,
  FormFieldGroupHeader,
  FormGroup,
} from '@patternfly/react-core/dist/esm/components/Form';
import { HelperText, HelperTextItem } from '@patternfly/react-core/dist/esm/components/HelperText';
import { MenuToggle } from '@patternfly/react-core/dist/esm/components/MenuToggle';
import {
  Select,
  SelectList,
  SelectOption,
} from '@patternfly/react-core/dist/esm/components/Select';
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
} from '@patternfly/react-core/dist/esm/components/Modal';
import { Radio } from '@patternfly/react-core/dist/esm/components/Radio';
import { Switch } from '@patternfly/react-core/dist/esm/components/Switch';
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput';
import { List, ListItem } from '@patternfly/react-core/dist/esm/components/List';
import { Popover } from '@patternfly/react-core/dist/esm/components/Popover';
import { InfoCircleIcon } from '@patternfly/react-icons/dist/esm/icons/info-circle-icon';
import { OutlinedQuestionCircleIcon } from '@patternfly/react-icons/dist/esm/icons/outlined-question-circle-icon';
import { StorageclassesStorageClassListItem } from '~/generated/data-contracts';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { useNamespaceSelectorWrapper } from '~/app/hooks/useNamespaceSelectorWrapper';
import { WorkspacesPodVolumeMountValue } from '~/app/types';
import ThemeAwareFormGroupWrapper from '~/shared/components/ThemeAwareFormGroupWrapper';
import { ResourceInputWrapper } from '~/shared/components/ResourceInputWrapper';
import {
  validateMountPath,
  getMountPathUniquenessError,
  normalizeMountPath,
} from '~/app/pages/Workspaces/Form/helpers';
import { MountPathField } from '~/app/pages/Workspaces/Form/MountPathField';

// DNS-1123 subdomain regex - lowercase alphanumeric, hyphens, dots
// Must start and end with alphanumeric, max 253 chars
const PVC_NAME_REGEX = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/;

const ACCESS_MODES = [
  { label: 'ReadWriteOnce (RWO)', value: 'ReadWriteOnce' },
  { label: 'ReadWriteMany (RWX)', value: 'ReadWriteMany' },
  { label: 'ReadOnlyMany (ROX)', value: 'ReadOnlyMany' },
  { label: 'ReadWriteOncePod (RWOP)', value: 'ReadWriteOncePod' },
] as const;

export interface VolumesCreateModalProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onVolumeCreated: (volume: WorkspacesPodVolumeMountValue) => void;
  /** PVC names already mounted in the other volume section (home or data) */
  excludedPvcNames?: Set<string>;
  /** Set of mount paths already in use across all attached volumes */
  mountedPaths: Set<string>;
  /** When provided the mount path is locked to this value and cannot be edited */
  fixedMountPath?: string;
}

export const VolumesCreateModal: React.FC<VolumesCreateModalProps> = ({
  isOpen,
  setIsOpen,
  onVolumeCreated,
  excludedPvcNames,
  mountedPaths,
  fixedMountPath,
}) => {
  const { api } = useNotebookAPI();
  const { selectedNamespace } = useNamespaceSelectorWrapper();

  // Form state
  const [pvcName, setPvcName] = useState('');
  const [mountPath, setMountPath] = useState(fixedMountPath ?? '/data/');
  const [isMountPathEditing, setIsMountPathEditing] = useState(false);
  const [storageClassName, setStorageClassName] = useState('');
  const [storageSize, setStorageSize] = useState('1Gi');
  const [accessMode, setAccessMode] = useState('ReadWriteOnce');
  const [readOnly, setReadOnly] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStorageClassOpen, setIsStorageClassOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Storage classes
  const [storageClasses, setStorageClasses] = useState<StorageclassesStorageClassListItem[]>([]);

  useEffect(() => {
    const fetch = async () => {
      try {
        const response = await api.storageClasses.listStorageClasses();
        const usable = response.data.filter((sc) => sc.canUse);
        setStorageClasses(usable);
        if (usable.length > 0) {
          setStorageClassName(usable[0].name);
        }
      } catch {
        // Storage classes unavailable - user can still type a name manually
      }
    };
    if (isOpen) {
      fetch();
    }
  }, [api.storageClasses, isOpen]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setPvcName('');
      setMountPath(fixedMountPath ?? '/data/');
      setIsMountPathEditing(false);
      setStorageSize('1Gi');
      setAccessMode('ReadWriteOnce');
      setReadOnly(false);
      setIsSubmitting(false);
      setIsStorageClassOpen(false);
      setError(null);
    }
  }, [isOpen, fixedMountPath]);

  const mountPathFormatError = isMountPathEditing ? validateMountPath(mountPath) : null;
  const mountPathUniquenessError = !mountPathFormatError
    ? getMountPathUniquenessError(mountedPaths, mountPath)
    : null;
  const mountPathError = mountPathFormatError ?? mountPathUniquenessError;

  const handleStartMountPathEdit = useCallback(() => {
    setIsMountPathEditing(true);
    setError(null);
  }, []);

  const handleConfirmMountPathEdit = useCallback(() => {
    const err =
      validateMountPath(mountPath) ?? getMountPathUniquenessError(mountedPaths, mountPath);
    if (err) {
      return;
    }
    setIsMountPathEditing(false);
  }, [mountPath, mountedPaths]);

  const handleCancelMountPathEdit = useCallback(() => {
    if (pvcName) {
      setMountPath(fixedMountPath ?? `/data/${pvcName}`);
    } else {
      setMountPath(fixedMountPath ?? '/data/');
    }
    setIsMountPathEditing(false);
  }, [pvcName, fixedMountPath]);

  const validateForm = useCallback((): string | null => {
    if (!pvcName) {
      return 'Volume name is required';
    }
    if (pvcName.length > 253) {
      return 'Volume name must be at most 253 characters';
    }
    if (!PVC_NAME_REGEX.test(pvcName)) {
      return 'Volume name must consist of lowercase alphanumeric characters or hyphens, and must start and end with an alphanumeric character';
    }
    if (excludedPvcNames?.has(pvcName)) {
      return 'A volume with this name is already mounted in the workspace';
    }
    if (!storageClassName) {
      return 'Storage class is required';
    }
    if (!storageSize) {
      return 'Storage size is required';
    }
    return null;
  }, [pvcName, storageClassName, storageSize, excludedPvcNames]);

  const handleSubmit = useCallback(async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    const trimmedPath = normalizeMountPath(mountPath);
    const mountErr =
      validateMountPath(trimmedPath) ?? getMountPathUniquenessError(mountedPaths, trimmedPath);
    if (mountErr) {
      setError(mountErr);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await api.pvc.createPvc(selectedNamespace, {
        data: {
          name: pvcName,
          storageClassName,
          requests: { storage: storageSize },
          accessModes: [accessMode],
        },
      });
      setIsOpen(false);
      onVolumeCreated({ pvcName, mountPath: trimmedPath, readOnly });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create PVC. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    validateForm,
    api.pvc,
    selectedNamespace,
    pvcName,
    mountPath,
    mountedPaths,
    storageClassName,
    storageSize,
    accessMode,
    setIsOpen,
    onVolumeCreated,
    readOnly,
  ]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, [setIsOpen]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      variant={ModalVariant.large}
      data-testid="create-volume-modal"
      aria-labelledby="create-volume-modal-title"
    >
      <ModalHeader
        title="Attach New Volume"
        description="Create a new volume and attach it to the workspace"
        labelId="create-volume-modal-title"
      />
      <ModalBody>
        <Form>
          {error && (
            <Alert variant={AlertVariant.danger} isInline title="Error">
              {error}
            </Alert>
          )}
          <ThemeAwareFormGroupWrapper label="Volume Name" isRequired fieldId="pvc-name">
            <TextInput
              id="pvc-name"
              data-testid="pvc-name-input"
              isRequired
              type="text"
              value={pvcName}
              onChange={(_, val) => {
                setPvcName(val);
                if (!isMountPathEditing) {
                  setMountPath(fixedMountPath ?? `/data/${val}`);
                }
                setError(null);
              }}
            />
          </ThemeAwareFormGroupWrapper>
          <ThemeAwareFormGroupWrapper label="Storage Class" isRequired fieldId="storage-class">
            {storageClasses.length > 0 ? (
              <Select
                id="storage-class"
                isOpen={isStorageClassOpen}
                selected={storageClassName}
                onSelect={(_ev, value) => {
                  setStorageClassName(String(value));
                  setIsStorageClassOpen(false);
                }}
                onOpenChange={setIsStorageClassOpen}
                toggle={(toggleRef) => (
                  <MenuToggle
                    ref={toggleRef}
                    onClick={() => setIsStorageClassOpen((prev) => !prev)}
                    isExpanded={isStorageClassOpen}
                    isFullWidth
                    data-testid="storage-class-select"
                  >
                    {storageClasses.find((sc) => sc.name === storageClassName)?.displayName ||
                      storageClassName}
                  </MenuToggle>
                )}
              >
                <SelectList>
                  {storageClasses.map((sc) => (
                    <SelectOption key={sc.name} value={sc.name} description={sc.description}>
                      {sc.displayName || sc.name}
                    </SelectOption>
                  ))}
                </SelectList>
              </Select>
            ) : (
              <TextInput
                id="storage-class"
                data-testid="storage-class-input"
                isRequired
                type="text"
                value={storageClassName}
                onChange={(_, val) => setStorageClassName(val)}
                placeholder="Enter storage class name"
              />
            )}
          </ThemeAwareFormGroupWrapper>
          <MountPathField
            variant="input"
            value={mountPath}
            onChange={(val) => {
              setMountPath(val);
              setError(null);
            }}
            isEditing={isMountPathEditing}
            onStartEdit={handleStartMountPathEdit}
            onConfirm={handleConfirmMountPathEdit}
            onCancel={handleCancelMountPathEdit}
            error={mountPathError}
            isFixed={!!fixedMountPath}
            fieldId="create-volume-mount-path"
          />
          <FormGroup fieldId="read-only" className="pf-v6-u-pt-sm">
            <Switch
              id="read-only-switch"
              data-testid="read-only-switch"
              label="Read-only access"
              isChecked={readOnly}
              onChange={(_ev, checked) => setReadOnly(checked)}
            />
          </FormGroup>
          <FormFieldGroupExpandable
            className="form-label-field-group"
            toggleAriaLabel="Volume Configuration"
            isExpanded
            header={
              <FormFieldGroupHeader
                titleText={{
                  text: 'Volume Configuration',
                  id: 'volume-configuration-title',
                }}
                titleDescription="Configure volume access mode and size"
              />
            }
          >
            <ThemeAwareFormGroupWrapper
              label="Access Mode"
              isRequired
              fieldId="access-mode"
              role="radiogroup"
              skipFieldset
              isInline
              labelHelp={
                <Popover
                  headerContent="Access mode"
                  bodyContent={
                    <>
                      Access mode is a Kubernetes concept that determines how nodes can interact
                      with the volume
                      <List className="pf-v6-u-mt-sm">
                        <ListItem>
                          <strong>ReadWriteMany (RWX)</strong> means that the volume can be attached
                          to many workspaces simultaneously
                        </ListItem>
                        <ListItem>
                          <strong>ReadOnlyMany (ROX)</strong> means that the volume can be attached
                          to many workspaces as read-onl
                        </ListItem>
                        <ListItem>
                          <strong>ReadWriteOnce (RWO)</strong> means that the volume can be attached
                          to a single workspace at a given time
                        </ListItem>
                        <ListItem>
                          <strong>ReadWriteOncePod (RWOP)</strong> means that the volume can be
                          attached to a single pod on a single node as read-write
                        </ListItem>
                      </List>
                    </>
                  }
                >
                  <OutlinedQuestionCircleIcon />
                </Popover>
              }
              helperTextNode={
                <HelperText>
                  <HelperTextItem>
                    <InfoCircleIcon className="pf-v6-u-mr-xs" />
                    Access mode cannot be changed after creation
                  </HelperTextItem>
                </HelperText>
              }
            >
              {ACCESS_MODES.map(({ label, value }) => (
                <Radio
                  key={value}
                  id={`access-mode-${value}`}
                  data-testid={`access-mode-${value}`}
                  name="access-mode"
                  label={label}
                  value={value}
                  isChecked={accessMode === value}
                  onChange={() => setAccessMode(value)}
                />
              ))}
            </ThemeAwareFormGroupWrapper>
            <ThemeAwareFormGroupWrapper
              label="Volume Size"
              isRequired
              fieldId="volume-size"
              skipFieldset
            >
              <ResourceInputWrapper
                value={storageSize}
                onChange={setStorageSize}
                type="storage"
                min={1}
                aria-label="volume-size"
              />
            </ThemeAwareFormGroupWrapper>
          </FormFieldGroupExpandable>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button
          key="create"
          variant="primary"
          onClick={handleSubmit}
          isLoading={isSubmitting}
          isDisabled={
            isSubmitting ||
            !pvcName ||
            !storageClassName ||
            !storageSize ||
            !!mountPathError ||
            isMountPathEditing
          }
          data-testid="create-volume-submit-button"
        >
          Create
        </Button>
        <Button
          key="cancel"
          variant="link"
          onClick={handleClose}
          isDisabled={isSubmitting}
          data-testid="create-volume-cancel-button"
        >
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
