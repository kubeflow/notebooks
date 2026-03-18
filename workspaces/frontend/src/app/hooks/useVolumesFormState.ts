import { Dispatch, SetStateAction, useCallback, useEffect, useState } from 'react';
import {
  StorageclassesStorageClassListItem,
  V1PersistentVolumeAccessMode,
} from '~/generated/data-contracts';
import { WorkspacesPodVolumeMountValue } from '~/app/types';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { useNamespaceSelectorWrapper } from '~/app/hooks/useNamespaceSelectorWrapper';
import {
  validateMountPath,
  getMountPathUniquenessError,
  normalizeMountPath,
} from '~/app/pages/Workspaces/Form/helpers';

// DNS-1123 subdomain regex - lowercase alphanumeric, hyphens, dots
// Must start and end with alphanumeric, max 253 chars
const PVC_NAME_REGEX = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/;

const validateForm = (
  pvcName: string,
  storageClassName: string,
  storageSize: string,
  excludedPvcNames?: Set<string>,
): string | null => {
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
};

interface UseVolumesFormStateArgs {
  isOpen: boolean;
  fixedMountPath?: string;
  volumeToEdit?: WorkspacesPodVolumeMountValue;
  excludedPvcNames?: Set<string>;
  mountedPaths: Set<string>;
  storageClasses: StorageclassesStorageClassListItem[];
  setIsOpen: (open: boolean) => void;
  onVolumeCreated: (volume: WorkspacesPodVolumeMountValue) => void;
  onVolumeEdited?: (mountPath: string, readOnly: boolean) => void;
}

interface UseVolumesFormStateResult {
  // Form field state
  pvcName: string;
  setPvcName: Dispatch<SetStateAction<string>>;
  mountPath: string;
  setMountPath: Dispatch<SetStateAction<string>>;
  storageClassName: string;
  setStorageClassName: Dispatch<SetStateAction<string>>;
  storageSize: string;
  setStorageSize: Dispatch<SetStateAction<string>>;
  accessMode: V1PersistentVolumeAccessMode;
  setAccessMode: Dispatch<SetStateAction<V1PersistentVolumeAccessMode>>;
  readOnly: boolean;
  setReadOnly: Dispatch<SetStateAction<boolean>>;
  // UI state
  isMountPathEditing: boolean;
  isStorageClassOpen: boolean;
  setIsStorageClassOpen: Dispatch<SetStateAction<boolean>>;
  isSubmitting: boolean;
  error: string | null;
  setError: Dispatch<SetStateAction<string | null>>;
  // Derived
  mountPathError: string | null;
  // Handlers
  handleStartMountPathEdit: () => void;
  handleConfirmMountPathEdit: () => void;
  handleCancelMountPathEdit: () => void;
  handleSubmit: () => Promise<void>;
  handleClose: () => void;
}

const useVolumesFormState = ({
  isOpen,
  fixedMountPath,
  volumeToEdit,
  excludedPvcNames,
  mountedPaths,
  storageClasses,
  setIsOpen,
  onVolumeCreated,
  onVolumeEdited,
}: UseVolumesFormStateArgs): UseVolumesFormStateResult => {
  const { api } = useNotebookAPI();
  const { selectedNamespace } = useNamespaceSelectorWrapper();

  const isEditMode = !!volumeToEdit;

  const [pvcName, setPvcName] = useState('');
  const [mountPath, setMountPath] = useState(fixedMountPath ?? '/data/');
  const [isMountPathEditing, setIsMountPathEditing] = useState(false);
  const [storageClassName, setStorageClassName] = useState('');
  const [storageSize, setStorageSize] = useState('1Gi');
  const [accessMode, setAccessMode] = useState<V1PersistentVolumeAccessMode>(
    V1PersistentVolumeAccessMode.ReadWriteOnce,
  );
  const [readOnly, setReadOnly] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStorageClassOpen, setIsStorageClassOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (isEditMode) {
        setPvcName(volumeToEdit.pvcName);
        setMountPath(volumeToEdit.mountPath);
        setReadOnly(volumeToEdit.readOnly ?? false);
      } else {
        setPvcName('');
        setMountPath(fixedMountPath ?? '/data/');
        const firstUsable = storageClasses.find((sc) => sc.canUse);
        setStorageClassName(firstUsable?.name ?? '');
        setStorageSize('1Gi');
        setAccessMode(V1PersistentVolumeAccessMode.ReadWriteOnce);
        setReadOnly(false);
      }
      setIsMountPathEditing(false);
      setIsSubmitting(false);
      setIsStorageClassOpen(false);
      setError(null);
    }
  }, [isOpen, fixedMountPath, isEditMode, volumeToEdit, storageClasses]);

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
    if (isEditMode) {
      setMountPath(volumeToEdit.mountPath);
    } else if (pvcName) {
      setMountPath(fixedMountPath ?? `/data/${pvcName}`);
    } else {
      setMountPath(fixedMountPath ?? '/data/');
    }
    setIsMountPathEditing(false);
  }, [pvcName, fixedMountPath, isEditMode, volumeToEdit]);

  const handleSubmit = useCallback(async () => {
    const trimmedPath = normalizeMountPath(mountPath);
    const mountErr =
      validateMountPath(trimmedPath) ?? getMountPathUniquenessError(mountedPaths, trimmedPath);
    if (mountErr) {
      setError(mountErr);
      return;
    }

    if (isEditMode) {
      onVolumeEdited?.(trimmedPath, readOnly);
      setIsOpen(false);
      return;
    }

    const validationError = validateForm(pvcName, storageClassName, storageSize, excludedPvcNames);
    if (validationError) {
      setError(validationError);
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
      onVolumeCreated({ pvcName, mountPath: trimmedPath, readOnly, isAttached: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create PVC. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [
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
    onVolumeEdited,
    readOnly,
    isEditMode,
    excludedPvcNames,
  ]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, [setIsOpen]);

  return {
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
  };
};

export default useVolumesFormState;
