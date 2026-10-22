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
import { Popover } from '@patternfly/react-core/dist/esm/components/Popover';
import { OutlinedQuestionCircleIcon } from '@patternfly/react-icons/dist/esm/icons/outlined-question-circle-icon';
import { Form } from '@patternfly/react-core/dist/esm/components/Form';
import { Switch } from '@patternfly/react-core/dist/esm/components/Switch';
import { Stack, StackItem } from '@patternfly/react-core/dist/esm/layouts/Stack';
import { TypeaheadSelect } from '@patternfly/react-templates';
import { PvcsPVCListItem } from '~/generated/data-contracts';
import ThemeAwareFormGroupWrapper from '~/shared/components/ThemeAwareFormGroupWrapper';
import {
  normalizeMountPath,
  validateMountPath,
  getMountPathUniquenessError,
  buildPVCSelectOptions,
  isPVCMountBlocked,
  getBlockedMountTooltip,
  getRWOInUseWarning,
} from '~/app/pages/Workspaces/Form/helpers';
import { MountPathField } from '~/app/pages/Workspaces/Form/MountPathField';
import usePVCs from '~/app/hooks/usePVCs';
import useStorageClasses from '~/app/hooks/useStorageClasses';
import { LoadingSpinner } from '~/app/components/LoadingSpinner';

const PVC_SELECT_EMPTY_KEY = 'pvc-select-empty';

export interface VolumesAttachModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onAttach: (pvc: PvcsPVCListItem, mountPath: string, readOnly: boolean) => void;
  namespace: string;
  /** Set of mount paths already in use across all attached volumes */
  mountedPaths: Set<string>;
  /**
   * When provided the mount path is locked to this value (sourced from the
   * workspace kind's podTemplate.volumeMountPaths.home) and cannot be edited.
   */
  fixedMountPath?: string;
  /** PVC names already mounted in the other volume section (home or data) */
  excludedPvcNames?: Set<string>;
  currentWorkspaceName?: string;
}

const isMountedByOther = (pvc: PvcsPVCListItem, currentWorkspaceName?: string): boolean => {
  const ownPodName = pvc.workspaces.find((ws) => ws.name === currentWorkspaceName)?.podTemplatePod
    ?.name;
  return (
    pvc.pods.some((pod) => pod.name !== ownPodName) ||
    pvc.workspaces.some((ws) => ws.name !== currentWorkspaceName)
  );
};

export const VolumesAttachModal: React.FC<VolumesAttachModalProps> = ({
  isOpen,
  setIsOpen,
  onAttach,
  namespace,
  mountedPaths,
  fixedMountPath,
  excludedPvcNames,
  currentWorkspaceName,
}) => {
  // ── Data fetching ───────────────────────────────────────────────────────

  const { pvcs: availablePVCs, pvcsLoaded, pvcLoadError, refreshPVCs } = usePVCs(namespace);
  const { storageClasses } = useStorageClasses(namespace);

  // ── Form state ───────────────────────────────────────────────────────────

  const [selectedPvcName, setSelectedPvcName] = useState('');
  const [mountPath, setMountPath] = useState(fixedMountPath ?? '/data/');
  const [isMountPathEditing, setIsMountPathEditing] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [formError, setFormError] = useState('');

  const mountPathFormatError = isMountPathEditing ? validateMountPath(mountPath) : null;
  const mountPathUniquenessError = !mountPathFormatError
    ? getMountPathUniquenessError(mountedPaths, mountPath)
    : null;
  const mountPathError = mountPathFormatError ?? mountPathUniquenessError;

  // ── Reset on open & refresh PVCs ─────────────────────────────────────────

  useEffect(() => {
    if (isOpen) {
      setSelectedPvcName('');
      setMountPath(fixedMountPath ?? '/data/');
      setIsMountPathEditing(false);
      setReadOnly(false);
      setFormError('');
      refreshPVCs();
    }
  }, [isOpen, fixedMountPath, refreshPVCs]);

  // ── Mount path handlers ──────────────────────────────────────────────────

  const handleStartMountPathEdit = useCallback(() => {
    setIsMountPathEditing(true);
    setFormError('');
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
    if (selectedPvcName) {
      setMountPath(fixedMountPath ?? `/data/${selectedPvcName}`);
    } else {
      setMountPath(fixedMountPath ?? '/data/');
    }
    setIsMountPathEditing(false);
  }, [selectedPvcName, fixedMountPath]);

  // ── In-use warning alert ─────────────────────────────────────────────────

  const selectedPvc = useMemo(
    () => availablePVCs.find((p) => p.name === selectedPvcName),
    [availablePVCs, selectedPvcName],
  );

  const isSelectedPvcBlocked = useMemo(
    () => !!selectedPvc && isPVCMountBlocked(selectedPvc, currentWorkspaceName),
    [selectedPvc, currentWorkspaceName],
  );

  const inUseAlert = useMemo(() => {
    if (!selectedPvc) {
      return null;
    }
    if (isPVCMountBlocked(selectedPvc, currentWorkspaceName)) {
      return {
        variant: AlertVariant.danger,
        title: 'Volume cannot be attached',
        body: `${getBlockedMountTooltip(selectedPvc, currentWorkspaceName) ?? 'This volume uses ReadWriteOncePod access mode and is already mounted by another pod or workspace.'} Detach it there before attaching it here.`,
      };
    }
    const rwoWarning = getRWOInUseWarning(selectedPvc, currentWorkspaceName);
    if (rwoWarning) {
      return {
        variant: AlertVariant.warning,
        title: 'Node-scoped volume in use',
        body: rwoWarning,
      };
    }
    if (isMountedByOther(selectedPvc, currentWorkspaceName)) {
      return {
        variant: AlertVariant.warning,
        title: 'Volume is currently in use',
        body: 'This volume is already mounted by other workspaces or pods. Verify that sharing is supported.',
      };
    }
    return null;
  }, [selectedPvc, currentWorkspaceName]);

  // ── Attach handler ───────────────────────────────────────────────────────

  const handleAttach = useCallback(() => {
    if (!selectedPvc || isPVCMountBlocked(selectedPvc, currentWorkspaceName)) {
      return;
    }
    const trimmedPath = normalizeMountPath(mountPath);
    if (mountedPaths.has(trimmedPath)) {
      setFormError(`Mount path "${trimmedPath}" is already in use by another volume.`);
      return;
    }
    onAttach(selectedPvc, trimmedPath, readOnly);
  }, [selectedPvc, mountPath, readOnly, mountedPaths, onAttach, currentWorkspaceName]);

  // ── Options ──────────────────────────────────────────────────────────────

  const initialOptions = useMemo(
    () =>
      buildPVCSelectOptions(
        availablePVCs,
        storageClasses,
        excludedPvcNames,
        selectedPvcName,
        currentWorkspaceName,
      ),
    [availablePVCs, storageClasses, excludedPvcNames, selectedPvcName, currentWorkspaceName],
  );

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      ouiaId="VolumesAttachModal"
      aria-labelledby="volumes-attach-modal-title"
      aria-describedby="volumes-attach-modal-body"
      data-testid="volumes-attach-modal"
      variant={ModalVariant.large}
    >
      <ModalHeader title="Attach Existing Volume" labelId="volumes-attach-modal-title" />
      <ModalBody id="volumes-attach-modal-body">
        {pvcLoadError ? (
          <Alert variant={AlertVariant.danger} isInline title="Error">
            {pvcLoadError}
          </Alert>
        ) : !pvcsLoaded && availablePVCs.length === 0 ? (
          <LoadingSpinner />
        ) : (
          <Stack hasGutter>
            {formError && (
              <StackItem>
                <Alert variant={AlertVariant.danger} isInline title="Error">
                  {formError}
                </Alert>
              </StackItem>
            )}
            {inUseAlert && (
              <StackItem>
                <Alert variant={inUseAlert.variant} isInline title={inUseAlert.title}>
                  {inUseAlert.body}
                </Alert>
              </StackItem>
            )}
            <StackItem>
              <Form>
                <ThemeAwareFormGroupWrapper label="Volume" fieldId="pvc-select">
                  <TypeaheadSelect
                    key={selectedPvcName || PVC_SELECT_EMPTY_KEY}
                    id="pvc-select"
                    initialOptions={initialOptions}
                    placeholder="Select a volume"
                    isScrollable
                    maxMenuHeight="25rem"
                    noOptionsFoundMessage={(filter) => `No volume found for "${filter}"`}
                    onSelect={(_ev, value) => {
                      setSelectedPvcName(value as string);
                      setMountPath(fixedMountPath ?? `/data/${value}`);
                      setIsMountPathEditing(false);
                      setFormError('');
                    }}
                    onClearSelection={() => setSelectedPvcName('')}
                  />
                </ThemeAwareFormGroupWrapper>
                <MountPathField
                  variant="input"
                  value={mountPath}
                  onChange={(val) => {
                    setMountPath(val);
                    setFormError('');
                  }}
                  isEditing={isMountPathEditing}
                  onStartEdit={handleStartMountPathEdit}
                  onConfirm={handleConfirmMountPathEdit}
                  onCancel={handleCancelMountPathEdit}
                  error={mountPathError}
                  isFixed={!!fixedMountPath}
                  fieldId="pvc-mount-path"
                />
                {!fixedMountPath && (
                  <ThemeAwareFormGroupWrapper
                    label="Read-only Access"
                    fieldId="pvc-read-only"
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
                      id="pvc-read-only-switch"
                      data-testid="pvc-read-only-switch"
                      label="Enabled"
                      hasCheckIcon
                      isChecked={readOnly}
                      onChange={(_ev, checked) => setReadOnly(checked)}
                    />
                  </ThemeAwareFormGroupWrapper>
                )}
              </Form>
            </StackItem>
          </Stack>
        )}
      </ModalBody>
      <ModalFooter>
        <Button
          key="attach"
          variant="primary"
          isDisabled={
            !pvcsLoaded ||
            !selectedPvcName ||
            !mountPath.trim() ||
            !!mountPathError ||
            isMountPathEditing ||
            isSelectedPvcBlocked
          }
          onClick={handleAttach}
          data-testid="attach-pvc-button"
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
