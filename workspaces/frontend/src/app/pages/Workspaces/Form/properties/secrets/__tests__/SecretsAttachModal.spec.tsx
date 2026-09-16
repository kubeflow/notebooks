import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SecretsAttachModal } from '~/app/pages/Workspaces/Form/properties/secrets/SecretsAttachModal';
import useSecrets from '~/app/hooks/useSecrets';

jest.mock('mod-arch-kubeflow', () => ({
  useThemeContext: () => ({ isMUITheme: false }),
}));
jest.mock('~/app/hooks/useSecrets', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockUseSecrets = useSecrets as jest.MockedFunction<typeof useSecrets>;

describe('SecretsAttachModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSecrets.mockReturnValue({
      secrets: [],
      secretsLoaded: true,
      secretLoadError: null,
      refreshSecrets: jest.fn(),
    });
  });

  it('fetches secrets using the namespace passed by the workspace form, not a global namespace selector', () => {
    render(
      <SecretsAttachModal
        isOpen
        setIsOpen={jest.fn()}
        onAttach={jest.fn()}
        namespace="workspace-namespace"
        mountedKeys={new Set()}
        existingMountPaths={new Set()}
      />,
    );

    expect(useSecrets).toHaveBeenCalledWith('workspace-namespace');
  });

  it('re-fetches for the new namespace when the namespace prop changes', () => {
    const { rerender } = render(
      <SecretsAttachModal
        isOpen
        setIsOpen={jest.fn()}
        onAttach={jest.fn()}
        namespace="namespace-a"
        mountedKeys={new Set()}
        existingMountPaths={new Set()}
      />,
    );
    expect(useSecrets).toHaveBeenCalledWith('namespace-a');

    rerender(
      <SecretsAttachModal
        isOpen
        setIsOpen={jest.fn()}
        onAttach={jest.fn()}
        namespace="namespace-b"
        mountedKeys={new Set()}
        existingMountPaths={new Set()}
      />,
    );
    expect(useSecrets).toHaveBeenCalledWith('namespace-b');
  });

  it('does not get stuck on a loading spinner once secrets have loaded for the given namespace', () => {
    render(
      <SecretsAttachModal
        isOpen
        setIsOpen={jest.fn()}
        onAttach={jest.fn()}
        namespace="workspace-namespace"
        mountedKeys={new Set()}
        existingMountPaths={new Set()}
      />,
    );

    expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
  });

  it('shows a loading spinner while secrets for the given namespace have not loaded yet', () => {
    mockUseSecrets.mockReturnValue({
      secrets: [],
      secretsLoaded: false,
      secretLoadError: null,
      refreshSecrets: jest.fn(),
    });

    render(
      <SecretsAttachModal
        isOpen
        setIsOpen={jest.fn()}
        onAttach={jest.fn()}
        namespace="workspace-namespace"
        mountedKeys={new Set()}
        existingMountPaths={new Set()}
      />,
    );

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });
});
