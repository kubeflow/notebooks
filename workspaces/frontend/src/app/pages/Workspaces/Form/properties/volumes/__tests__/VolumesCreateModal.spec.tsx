import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { VolumesCreateModal } from '~/app/pages/Workspaces/Form/properties/volumes/VolumesCreateModal';
import useStorageClasses from '~/app/hooks/useStorageClasses';
import useVolumesFormState from '~/app/hooks/useVolumesFormState';
import { V1PersistentVolumeAccessMode } from '~/generated/data-contracts';

jest.mock('mod-arch-kubeflow', () => ({
  useThemeContext: () => ({ isMUITheme: false }),
}));
jest.mock('~/app/hooks/useStorageClasses', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('~/app/hooks/useVolumesFormState', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockUseStorageClasses = useStorageClasses as jest.MockedFunction<typeof useStorageClasses>;
const mockUseVolumesFormState = useVolumesFormState as jest.MockedFunction<
  typeof useVolumesFormState
>;

const baseFormState: ReturnType<typeof useVolumesFormState> = {
  pvcName: '',
  setPvcName: jest.fn(),
  mountPath: '/data/',
  setMountPath: jest.fn(),
  storageClassName: '',
  setStorageClassName: jest.fn(),
  storageSize: '1Gi',
  setStorageSize: jest.fn(),
  accessMode: V1PersistentVolumeAccessMode.ReadWriteOnce,
  setAccessMode: jest.fn(),
  readOnly: false,
  setReadOnly: jest.fn(),
  isMountPathEditing: false,
  isStorageClassOpen: false,
  setIsStorageClassOpen: jest.fn(),
  isAccessModeOpen: false,
  setIsAccessModeOpen: jest.fn(),
  isSubmitting: false,
  error: null,
  setError: jest.fn(),
  mountPathError: null,
  handleStartMountPathEdit: jest.fn(),
  handleConfirmMountPathEdit: jest.fn(),
  handleCancelMountPathEdit: jest.fn(),
  handleSubmit: jest.fn(),
  handleClose: jest.fn(),
};

describe('VolumesCreateModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseStorageClasses.mockReturnValue({ storageClasses: [], storageClassLoadError: null });
    mockUseVolumesFormState.mockReturnValue(baseFormState);
  });

  it('resolves storage classes and form state using the namespace passed by the workspace form, not a global namespace selector', () => {
    render(
      <VolumesCreateModal
        isOpen
        setIsOpen={jest.fn()}
        onVolumeCreated={jest.fn()}
        namespace="workspace-namespace"
        mountedPaths={new Set()}
      />,
    );

    expect(useStorageClasses).toHaveBeenCalledWith('workspace-namespace');
    expect(useVolumesFormState).toHaveBeenCalledWith(
      expect.objectContaining({ namespace: 'workspace-namespace' }),
    );
  });

  it('re-resolves for the new namespace when the namespace prop changes', () => {
    const { rerender } = render(
      <VolumesCreateModal
        isOpen
        setIsOpen={jest.fn()}
        onVolumeCreated={jest.fn()}
        namespace="namespace-a"
        mountedPaths={new Set()}
      />,
    );
    expect(useStorageClasses).toHaveBeenCalledWith('namespace-a');

    rerender(
      <VolumesCreateModal
        isOpen
        setIsOpen={jest.fn()}
        onVolumeCreated={jest.fn()}
        namespace="namespace-b"
        mountedPaths={new Set()}
      />,
    );
    expect(useStorageClasses).toHaveBeenCalledWith('namespace-b');
    expect(useVolumesFormState).toHaveBeenCalledWith(
      expect.objectContaining({ namespace: 'namespace-b' }),
    );
  });
});
