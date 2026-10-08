import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { VolumesAttachModal } from '~/app/pages/Workspaces/Form/properties/volumes/VolumesAttachModal';
import usePVCs from '~/app/hooks/usePVCs';
import useStorageClasses from '~/app/hooks/useStorageClasses';

jest.mock('mod-arch-kubeflow', () => ({
  useThemeContext: () => ({ isMUITheme: false }),
}));
jest.mock('~/app/hooks/usePVCs', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('~/app/hooks/useStorageClasses', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockUsePVCs = usePVCs as jest.MockedFunction<typeof usePVCs>;
const mockUseStorageClasses = useStorageClasses as jest.MockedFunction<typeof useStorageClasses>;

describe('VolumesAttachModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseStorageClasses.mockReturnValue({ storageClasses: [], storageClassLoadError: null });
    mockUsePVCs.mockReturnValue({
      pvcs: [],
      pvcsLoaded: true,
      pvcLoadError: null,
      refreshPVCs: jest.fn(),
    });
  });

  it('fetches PVCs and storage classes using the namespace passed by the workspace form, not a global namespace selector', () => {
    render(
      <VolumesAttachModal
        isOpen
        setIsOpen={jest.fn()}
        onAttach={jest.fn()}
        namespace="workspace-namespace"
        mountedPaths={new Set()}
      />,
    );

    expect(usePVCs).toHaveBeenCalledWith('workspace-namespace');
    expect(useStorageClasses).toHaveBeenCalledWith('workspace-namespace');
  });

  it('re-fetches for the new namespace when the namespace prop changes', () => {
    const { rerender } = render(
      <VolumesAttachModal
        isOpen
        setIsOpen={jest.fn()}
        onAttach={jest.fn()}
        namespace="namespace-a"
        mountedPaths={new Set()}
      />,
    );
    expect(usePVCs).toHaveBeenCalledWith('namespace-a');

    rerender(
      <VolumesAttachModal
        isOpen
        setIsOpen={jest.fn()}
        onAttach={jest.fn()}
        namespace="namespace-b"
        mountedPaths={new Set()}
      />,
    );
    expect(usePVCs).toHaveBeenCalledWith('namespace-b');
  });

  it('does not get stuck on a loading spinner once PVCs have loaded for the given namespace', () => {
    render(
      <VolumesAttachModal
        isOpen
        setIsOpen={jest.fn()}
        onAttach={jest.fn()}
        namespace="workspace-namespace"
        mountedPaths={new Set()}
      />,
    );

    expect(screen.getByTestId('attach-pvc-button')).toBeInTheDocument();
    expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
  });

  it('shows a loading spinner while PVCs for the given namespace have not loaded yet', () => {
    mockUsePVCs.mockReturnValue({
      pvcs: [],
      pvcsLoaded: false,
      pvcLoadError: null,
      refreshPVCs: jest.fn(),
    });

    render(
      <VolumesAttachModal
        isOpen
        setIsOpen={jest.fn()}
        onAttach={jest.fn()}
        namespace="workspace-namespace"
        mountedPaths={new Set()}
      />,
    );

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });
});
