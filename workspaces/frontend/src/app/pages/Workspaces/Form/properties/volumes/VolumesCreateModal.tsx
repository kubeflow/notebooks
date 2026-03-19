import React from 'react';
import { Alert, AlertVariant } from '@patternfly/react-core/dist/esm/components/Alert';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import {
  Form,
  FormFieldGroup,
  FormFieldGroupHeader,
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
import { V1PersistentVolumeAccessMode } from '~/generated/data-contracts';
import useStorageClasses from '~/app/hooks/useStorageClasses';
import useVolumesFormState from '~/app/hooks/useVolumesFormState';
import { WorkspacesPodVolumeMountValue } from '~/app/types';
import ThemeAwareFormGroupWrapper from '~/shared/components/ThemeAwareFormGroupWrapper';
import { ResourceInputWrapper } from '~/shared/components/ResourceInputWrapper';
import { MountPathField } from '~/app/pages/Workspaces/Form/MountPathField';

const ACCESS_MODES = [
  { label: 'ReadWriteOnce (RWO)', value: V1PersistentVolumeAccessMode.ReadWriteOnce },
  { label: 'ReadWriteMany (RWX)', value: V1PersistentVolumeAccessMode.ReadWriteMany },
  { label: 'ReadOnlyMany (ROX)', value: V1PersistentVolumeAccessMode.ReadOnlyMany },
  { label: 'ReadWriteOncePod (RWOP)', value: V1PersistentVolumeAccessMode.ReadWriteOncePod },
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
  /** When provided, the modal operates in edit mode */
  volumeToEdit?: WorkspacesPodVolumeMountValue;
  /** Called when a volume is saved in edit mode */
  onVolumeEdited?: (mountPath: string, readOnly: boolean) => void;
}

export const VolumesCreateModal: React.FC<VolumesCreateModalProps> = ({
  isOpen,
  setIsOpen,
  onVolumeCreated,
  excludedPvcNames,
  mountedPaths,
  fixedMountPath,
  volumeToEdit,
  onVolumeEdited,
}) => {
  const { storageClasses, storageClassLoadError } = useStorageClasses();

  const isEditMode = !!volumeToEdit;

  const {
    pvcName,
    setPvcName,
    mountPath,
    setMountPath,
    storageClassName,
    setStorageClassName,
    storageSize,
    setStorageSize,
    accessMode,
    setAccessMode,
    readOnly,
    setReadOnly,
    isMountPathEditing,
    isStorageClassOpen,
    setIsStorageClassOpen,
    isSubmitting,
    error,
    setError,
    mountPathError,
    handleStartMountPathEdit,
    handleConfirmMountPathEdit,
    handleCancelMountPathEdit,
    handleSubmit,
    handleClose,
  } = useVolumesFormState({
    isOpen,
    fixedMountPath,
    volumeToEdit,
    excludedPvcNames,
    mountedPaths,
    storageClasses,
    setIsOpen,
    onVolumeCreated,
    onVolumeEdited,
  });

  const mountConfigFields = (
    <>
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
      <ThemeAwareFormGroupWrapper
        label="Read-only Access"
        fieldId="read-only"
        skipFieldset
        labelHelp={
          <Popover
            headerContent="Read-only access"
            bodyContent="Mount the volume as read-only when this workspace only needs to read data. This prevents accidental or unintended writes to shared volumes."
          >
            <OutlinedQuestionCircleIcon />
          </Popover>
        }
      >
        <Switch
          id="read-only-switch"
          data-testid="read-only-switch"
          label="Enabled"
          hasCheckIcon
          isChecked={readOnly}
          onChange={(_ev, checked) => setReadOnly(checked)}
        />
      </ThemeAwareFormGroupWrapper>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      variant={ModalVariant.large}
      data-testid="create-volume-modal"
      aria-labelledby="create-volume-modal-title"
    >
      <ModalHeader
        title={isEditMode ? 'Edit Volume' : 'Create New Volume'}
        description={
          isEditMode
            ? `Edit the mount configuration for the volume ${volumeToEdit.pvcName}`
            : 'Create a new persistent volume claim (PVC) and configure how it is mounted in the workspace'
        }
        labelId="create-volume-modal-title"
      />
      <ModalBody>
        <Form>
          {error && (
            <Alert variant={AlertVariant.danger} isInline title="Error">
              {error}
            </Alert>
          )}
          {!isEditMode && (
            <FormFieldGroup
              className="form-label-field-group"
              header={
                <FormFieldGroupHeader
                  titleText={{
                    text: 'PVC Configuration',
                    id: 'pvc-configuration-title',
                  }}
                  titleDescription="Configure the persistent volume claim's name, storage class, access mode, and size"
                />
              }
            >
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
                        <SelectOption
                          key={sc.name}
                          value={sc.name}
                          description={sc.description}
                          isDisabled={!sc.canUse}
                          data-testid={`storage-class-option-${sc.name}`}
                        >
                          {sc.displayName || sc.name}
                        </SelectOption>
                      ))}
                    </SelectList>
                  </Select>
                ) : (
                  <>
                    <TextInput
                      id="storage-class"
                      data-testid="storage-class-input"
                      isRequired
                      type="text"
                      value={storageClassName}
                      onChange={(_, val) => setStorageClassName(val)}
                      placeholder="Enter storage class name"
                    />
                    {storageClassLoadError && (
                      <HelperText>
                        <HelperTextItem variant="warning">{storageClassLoadError}</HelperTextItem>
                      </HelperText>
                    )}
                  </>
                )}
              </ThemeAwareFormGroupWrapper>
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
                            <strong>ReadWriteMany (RWX)</strong> means that the volume can be
                            attached to many workspaces simultaneously
                          </ListItem>
                          <ListItem>
                            <strong>ReadOnlyMany (ROX)</strong> means that the volume can be
                            attached to many workspaces as read-only
                          </ListItem>
                          <ListItem>
                            <strong>ReadWriteOnce (RWO)</strong> means that the volume can be
                            attached to a single workspace at a given time
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
            </FormFieldGroup>
          )}
          {isEditMode ? (
            mountConfigFields
          ) : (
            <FormFieldGroup
              className="form-label-field-group"
              header={
                <FormFieldGroupHeader
                  titleText={{
                    text: 'Mount Configuration',
                    id: 'mount-configuration-title',
                  }}
                  titleDescription="Configure how the volume is mounted in the workspace"
                />
              }
            >
              {mountConfigFields}
            </FormFieldGroup>
          )}
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
            !!mountPathError ||
            isMountPathEditing ||
            (!isEditMode && (!pvcName || !storageClassName || !storageSize))
          }
          data-testid="create-volume-submit-button"
        >
          {isEditMode ? 'Save' : 'Create'}
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
