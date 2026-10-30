import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import useSecrets from '~/app/hooks/useSecrets';
import { buildMockSecret } from '~/shared/mock/mockBuilder';
import { WorkspaceFormPropertiesSecrets } from '~/app/pages/Workspaces/Form/properties/WorkspaceFormPropertiesSecrets';

jest.mock('~/app/hooks/useSecrets', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('~/app/hooks/useNotebookAPI', () => ({ useNotebookAPI: () => ({ api: {} }) }));
jest.mock('~/app/hooks/useSecretKeys', () => ({
  useSecretKeys: () => ({ getSecretKeysState: () => ({ isLoaded: true, keys: [] }) }),
}));
jest.mock('~/app/pages/Workspaces/Form/properties/secrets/SecretsAttachModal', () => ({
  SecretsAttachModal: () => null,
}));
jest.mock('~/app/pages/Workspaces/Form/properties/secrets/SecretsCreateModal', () => ({
  SecretsCreateModal: ({ isOpen, namespace }: { isOpen: boolean; namespace: string }) =>
    isOpen ? <div data-testid="edit-modal">{namespace}</div> : null,
}));

const mockUseSecrets = jest.mocked(useSecrets);
const renderSecrets = () => {
  render(
    <WorkspaceFormPropertiesSecrets
      namespace="workspace-namespace"
      secrets={[{ secretName: 'my-secret', mountPath: '/secrets', isAttached: true }]}
      setSecrets={jest.fn()}
    />,
  );
  fireEvent.click(screen.getByTestId('secret-kebab-my-secret'));
};

describe('Workspace secret edit permissions', () => {
  beforeEach(() => {
    mockUseSecrets.mockReturnValue({
      secrets: [],
      secretsLoaded: true,
      secretLoadError: null,
      refreshSecrets: jest.fn(),
    });
  });

  it.each([
    { secretsLoaded: false, secretLoadError: null },
    { secretsLoaded: true, secretLoadError: null },
    { secretsLoaded: false, secretLoadError: 'Failed to load secret details.' },
  ])('keeps Edit disabled without API permission metadata: %j', (state) => {
    mockUseSecrets.mockReturnValue({ ...mockUseSecrets('workspace-namespace'), ...state });
    renderSecrets();
    const edit = screen.getByTestId('edit-secret-my-secret');
    expect(edit).toHaveClass('pf-m-aria-disabled');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
    expect(screen.queryByTestId('edit-modal')).not.toBeInTheDocument();
  });

  it('keeps Edit disabled when the API denies updates', () => {
    mockUseSecrets.mockReturnValue({
      ...mockUseSecrets('workspace-namespace'),
      secrets: [buildMockSecret({ name: 'my-secret', canUpdate: false })],
    });
    renderSecrets();
    expect(screen.getByTestId('edit-secret-my-secret')).toHaveClass('pf-m-aria-disabled');
  });

  it('opens the editor in the workspace namespace when the API permits updates', () => {
    mockUseSecrets.mockReturnValue({
      ...mockUseSecrets('workspace-namespace'),
      secrets: [buildMockSecret({ name: 'my-secret', canUpdate: true })],
    });
    renderSecrets();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
    expect(screen.getByTestId('edit-modal')).toHaveTextContent('workspace-namespace');
  });
});
