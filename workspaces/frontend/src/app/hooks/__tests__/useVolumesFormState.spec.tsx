import { act } from '@testing-library/react';
import { renderHook } from '~/__tests__/unit/testUtils/hooks';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { useNamespaceSelectorWrapper } from '~/app/hooks/useNamespaceSelectorWrapper';
import useVolumesFormState from '~/app/hooks/useVolumesFormState';
import { NotebookApis } from '~/shared/api/notebookApi';
import {
  StorageclassesStorageClassListItem,
  V1PersistentVolumeAccessMode,
} from '~/generated/data-contracts';
import { WorkspacesPodVolumeMountValue } from '~/app/types';

jest.mock('~/app/hooks/useNotebookAPI', () => ({
  useNotebookAPI: jest.fn(),
}));
jest.mock('~/app/hooks/useNamespaceSelectorWrapper', () => ({
  useNamespaceSelectorWrapper: jest.fn(),
}));

const mockUseNotebookAPI = useNotebookAPI as jest.MockedFunction<typeof useNotebookAPI>;
const mockUseNamespaceSelectorWrapper = useNamespaceSelectorWrapper as jest.MockedFunction<
  typeof useNamespaceSelectorWrapper
>;

const mockCreatePvc = jest.fn();

const mockStorageClasses: StorageclassesStorageClassListItem[] = [
  { name: 'standard', displayName: 'Standard', canUse: true, description: '' },
  { name: 'fast', displayName: 'Fast SSD', canUse: false, description: 'NVMe' },
];

const defaultArgs = {
  isOpen: true,
  mountedPaths: new Set<string>(),
  storageClasses: mockStorageClasses,
  setIsOpen: jest.fn(),
  onVolumeCreated: jest.fn(),
};

describe('useVolumesFormState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseNotebookAPI.mockReturnValue({
      api: { pvc: { createPvc: mockCreatePvc } } as unknown as NotebookApis,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });
    mockUseNamespaceSelectorWrapper.mockReturnValue({
      selectedNamespace: 'test-namespace',
      namespacesLoaded: true,
    } as ReturnType<typeof useNamespaceSelectorWrapper>);
  });

  describe('create mode: modal opens', () => {
    it('resets all fields to defaults and seeds storageClassName from first usable class', () => {
      const { result } = renderHook(() => useVolumesFormState(defaultArgs));

      expect(result.current.pvcName).toBe('');
      expect(result.current.mountPath).toBe('/data/');
      expect(result.current.storageClassName).toBe('standard');
      expect(result.current.storageSize).toBe('1Gi');
      expect(result.current.accessMode).toBe(V1PersistentVolumeAccessMode.ReadWriteOnce);
      expect(result.current.readOnly).toBe(false);
      expect(result.current.isMountPathEditing).toBe(false);
      expect(result.current.isSubmitting).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('uses fixedMountPath when provided', () => {
      const { result } = renderHook(() =>
        useVolumesFormState({ ...defaultArgs, fixedMountPath: '/home/user' }),
      );
      expect(result.current.mountPath).toBe('/home/user');
    });

    it('seeds storageClassName to empty string when no usable class exists', () => {
      const noUsableClasses: StorageclassesStorageClassListItem[] = [
        { name: 'fast', displayName: 'Fast', canUse: false, description: '' },
      ];
      const { result } = renderHook(() =>
        useVolumesFormState({ ...defaultArgs, storageClasses: noUsableClasses }),
      );
      expect(result.current.storageClassName).toBe('');
    });
  });

  describe('edit mode: modal opens', () => {
    const volumeToEdit: WorkspacesPodVolumeMountValue = {
      pvcName: 'my-pvc',
      mountPath: '/mnt/data',
      readOnly: true,
      isAttached: true,
    };

    it('loads pvcName, mountPath, and readOnly from volumeToEdit', () => {
      const { result } = renderHook(() => useVolumesFormState({ ...defaultArgs, volumeToEdit }));

      expect(result.current.pvcName).toBe('my-pvc');
      expect(result.current.mountPath).toBe('/mnt/data');
      expect(result.current.readOnly).toBe(true);
    });

    it('defaults readOnly to false when volumeToEdit.readOnly is undefined', () => {
      const { result } = renderHook(() =>
        useVolumesFormState({
          ...defaultArgs,
          volumeToEdit: { pvcName: 'pvc', mountPath: '/mnt', isAttached: true },
        }),
      );
      expect(result.current.readOnly).toBe(false);
    });
  });

  describe('handleStartMountPathEdit', () => {
    it('sets isMountPathEditing to true and clears error', () => {
      const { result } = renderHook(() => useVolumesFormState(defaultArgs));

      act(() => {
        result.current.setError('some error');
      });
      act(() => {
        result.current.handleStartMountPathEdit();
      });

      expect(result.current.isMountPathEditing).toBe(true);
      expect(result.current.error).toBeNull();
    });
  });

  describe('handleCancelMountPathEdit', () => {
    it('restores mountPath to /data/ when no pvcName and no fixedMountPath', () => {
      const { result } = renderHook(() => useVolumesFormState(defaultArgs));

      act(() => {
        result.current.handleStartMountPathEdit();
        result.current.setMountPath('/some/other/path');
      });
      act(() => {
        result.current.handleCancelMountPathEdit();
      });

      expect(result.current.mountPath).toBe('/data/');
      expect(result.current.isMountPathEditing).toBe(false);
    });

    it('restores mountPath to /data/<pvcName> when pvcName is set', () => {
      const { result } = renderHook(() => useVolumesFormState(defaultArgs));

      act(() => {
        result.current.setPvcName('my-vol');
        result.current.handleStartMountPathEdit();
        result.current.setMountPath('/wrong/path');
      });
      act(() => {
        result.current.handleCancelMountPathEdit();
      });

      expect(result.current.mountPath).toBe('/data/my-vol');
    });

    it('restores to volumeToEdit.mountPath in edit mode', () => {
      const volumeToEdit: WorkspacesPodVolumeMountValue = {
        pvcName: 'pvc',
        mountPath: '/original',
        isAttached: true,
      };
      const { result } = renderHook(() => useVolumesFormState({ ...defaultArgs, volumeToEdit }));

      act(() => {
        result.current.handleStartMountPathEdit();
        result.current.setMountPath('/changed');
      });
      act(() => {
        result.current.handleCancelMountPathEdit();
      });

      expect(result.current.mountPath).toBe('/original');
    });
  });

  describe('handleConfirmMountPathEdit', () => {
    it('exits editing mode when the path is valid', () => {
      const { result } = renderHook(() => useVolumesFormState(defaultArgs));

      act(() => {
        result.current.handleStartMountPathEdit();
        result.current.setMountPath('/valid/path');
      });
      act(() => {
        result.current.handleConfirmMountPathEdit();
      });

      expect(result.current.isMountPathEditing).toBe(false);
    });

    it('stays in editing mode when the path is invalid', () => {
      const { result } = renderHook(() => useVolumesFormState(defaultArgs));

      act(() => {
        result.current.handleStartMountPathEdit();
        result.current.setMountPath('no-leading-slash');
      });
      act(() => {
        result.current.handleConfirmMountPathEdit();
      });

      expect(result.current.isMountPathEditing).toBe(true);
    });

    it('stays in editing mode when the path is already in use', () => {
      const { result } = renderHook(() =>
        useVolumesFormState({ ...defaultArgs, mountedPaths: new Set(['/used']) }),
      );

      act(() => {
        result.current.handleStartMountPathEdit();
        result.current.setMountPath('/used');
      });
      act(() => {
        result.current.handleConfirmMountPathEdit();
      });

      expect(result.current.isMountPathEditing).toBe(true);
    });
  });

  describe('handleClose', () => {
    it('calls setIsOpen(false)', () => {
      const setIsOpen = jest.fn();
      const { result } = renderHook(() => useVolumesFormState({ ...defaultArgs, setIsOpen }));

      act(() => {
        result.current.handleClose();
      });

      expect(setIsOpen).toHaveBeenCalledWith(false);
    });
  });

  describe('handleSubmit', () => {
    it('create mode: calls createPvc, onVolumeCreated, and closes modal on success', async () => {
      mockCreatePvc.mockResolvedValue({});
      const setIsOpen = jest.fn();
      const onVolumeCreated = jest.fn();
      const { result } = renderHook(() =>
        useVolumesFormState({ ...defaultArgs, setIsOpen, onVolumeCreated }),
      );

      act(() => {
        result.current.setPvcName('my-pvc');
        result.current.setMountPath('/data/my-pvc');
      });

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(mockCreatePvc).toHaveBeenCalledWith('test-namespace', {
        data: {
          name: 'my-pvc',
          storageClassName: 'standard',
          requests: { storage: '1Gi' },
          accessModes: [V1PersistentVolumeAccessMode.ReadWriteOnce],
        },
      });
      expect(onVolumeCreated).toHaveBeenCalledWith({
        pvcName: 'my-pvc',
        mountPath: '/data/my-pvc',
        readOnly: false,
        isAttached: false,
      });
      expect(setIsOpen).toHaveBeenCalledWith(false);
    });

    it('create mode: sets error and stays open when API call fails', async () => {
      mockCreatePvc.mockRejectedValue(new Error('network error'));
      const setIsOpen = jest.fn();
      const onVolumeCreated = jest.fn();
      const { result } = renderHook(() =>
        useVolumesFormState({ ...defaultArgs, setIsOpen, onVolumeCreated }),
      );

      act(() => {
        result.current.setPvcName('my-pvc');
        result.current.setMountPath('/data/my-pvc');
      });

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(result.current.error).toBe('network error');
      expect(setIsOpen).not.toHaveBeenCalled();
      expect(onVolumeCreated).not.toHaveBeenCalled();
    });

    it('edit mode: calls onVolumeEdited and closes modal, skips API', async () => {
      const setIsOpen = jest.fn();
      const onVolumeEdited = jest.fn();
      const volumeToEdit: WorkspacesPodVolumeMountValue = {
        pvcName: 'pvc',
        mountPath: '/mnt/data',
        isAttached: true,
      };
      const { result } = renderHook(() =>
        useVolumesFormState({ ...defaultArgs, setIsOpen, onVolumeEdited, volumeToEdit }),
      );

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(mockCreatePvc).not.toHaveBeenCalled();
      expect(onVolumeEdited).toHaveBeenCalledWith('/mnt/data', false);
      expect(setIsOpen).toHaveBeenCalledWith(false);
    });

    it('create mode: sets error and makes no API call when validation fails', async () => {
      const setIsOpen = jest.fn();
      const onVolumeCreated = jest.fn();
      const { result } = renderHook(() =>
        useVolumesFormState({ ...defaultArgs, setIsOpen, onVolumeCreated }),
      );

      // pvcName is empty — validation should fail
      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(result.current.error).toBe('Volume name is required');
      expect(mockCreatePvc).not.toHaveBeenCalled();
      expect(setIsOpen).not.toHaveBeenCalled();
    });

    it('sets error when mount path is invalid and makes no API call', async () => {
      const setIsOpen = jest.fn();
      const { result } = renderHook(() => useVolumesFormState({ ...defaultArgs, setIsOpen }));

      act(() => {
        result.current.setPvcName('my-pvc');
        result.current.setMountPath('no-leading-slash');
      });

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(result.current.error).toBeTruthy();
      expect(mockCreatePvc).not.toHaveBeenCalled();
      expect(setIsOpen).not.toHaveBeenCalled();
    });
  });
});
