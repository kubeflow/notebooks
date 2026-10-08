import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import useSecret, { SecretDetails } from '~/app/hooks/useSecret';
import { buildMockSecret } from '~/shared/mock/mockBuilder';
import { SecretsCreateModal } from '~/app/pages/Workspaces/Form/properties/secrets/SecretsCreateModal';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { NotebookApis } from '~/shared/api/notebookApi';
import { SecretsSecretListItem } from '~/generated/data-contracts';

const mockCreateSecret = jest.fn();

jest.mock('mod-arch-kubeflow', () => ({
  useThemeContext: () => ({ isMUITheme: false }),
}));

jest.mock('~/app/hooks/useNotebookAPI', () => ({
  useNotebookAPI: () => ({
    api: { secrets: { createSecret: mockCreateSecret, updateSecret: jest.fn() } },
  }),
}));

jest.mock('~/app/hooks/useNamespaceSelectorWrapper', () => ({
  useNamespaceSelectorWrapper: () => ({ selectedNamespace: 'default' }),
}));

jest.mock('~/app/hooks/useSecret', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockUseSecret = useSecret as jest.MockedFunction<typeof useSecret>;

const EMPTY_SECRET: SecretDetails = { keyValuePairs: [], immutable: false, type: 'Opaque' };

const mockSecretLoad = (loadError?: Error) =>
  mockUseSecret.mockReturnValue([EMPTY_SECRET, false, loadError, jest.fn()]);

const renderModal = (props: Partial<React.ComponentProps<typeof SecretsCreateModal>> = {}) =>
  render(
    <SecretsCreateModal
      isOpen
      setIsOpen={jest.fn()}
      existingSecretNames={[]}
      namespace="default"
      {...props}
    />,
  );

const fillKeyValuePair = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByTestId('key-input'), 'username');
  await user.type(screen.getByLabelText(/^Value/), 'admin');
};

describe('SecretsCreateModal errors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSecretLoad();
  });

  it('does not show a validation error before the first submit', () => {
    renderModal();
    expect(screen.queryByTestId('error-alert')).not.toBeInTheDocument();
  });

  it('shows the validation error in the footer, next to the action buttons', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByTestId('secret-modal-submit-button'));

    const alert = screen.getByTestId('error-alert');
    expect(alert).toHaveTextContent('Secret name is required');
    // The alert and the submit button share the modal footer
    const footer = alert.closest('footer');
    expect(footer).not.toBeNull();
    expect(
      within(footer as HTMLElement).getByTestId('secret-modal-submit-button'),
    ).toBeInTheDocument();
    expect(mockCreateSecret).not.toHaveBeenCalled();
  });

  it('updates and then clears the validation error as the input is corrected', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByTestId('secret-modal-submit-button'));
    expect(screen.getByTestId('error-alert')).toHaveTextContent('Secret name is required');

    await user.type(screen.getByTestId('secret-name-input'), 'my-secret');
    expect(screen.getByTestId('error-alert')).toHaveTextContent('Key is required (pair 1)');

    await fillKeyValuePair(user);
    expect(screen.queryByTestId('error-alert')).not.toBeInTheDocument();
  });

  it('clears a failed submit error once the user edits the form', async () => {
    const user = userEvent.setup();
    mockCreateSecret.mockRejectedValueOnce(new Error('secret already exists'));
    renderModal();

    await user.type(screen.getByTestId('secret-name-input'), 'my-secret');
    await fillKeyValuePair(user);
    await user.click(screen.getByTestId('secret-modal-submit-button'));

    expect(await screen.findByTestId('error-alert')).toHaveTextContent('secret already exists');

    await user.type(screen.getByTestId('secret-name-input'), '-2');
    expect(screen.queryByTestId('error-alert')).not.toBeInTheDocument();
  });

  it('clears a failed submit error once the Immutable switch is toggled', async () => {
    const user = userEvent.setup();
    mockCreateSecret.mockRejectedValueOnce(new Error('secret already exists'));
    renderModal();

    await user.type(screen.getByTestId('secret-name-input'), 'my-secret');
    await fillKeyValuePair(user);
    await user.click(screen.getByTestId('secret-modal-submit-button'));

    expect(await screen.findByTestId('error-alert')).toHaveTextContent('secret already exists');

    await user.click(screen.getByTestId('secret-immutable-switch'));
    expect(screen.queryByTestId('error-alert')).not.toBeInTheDocument();
  });

  it('shows a failed secret load in the footer and keeps Save disabled', () => {
    mockSecretLoad(new Error('forbidden'));
    renderModal({ secretToEdit: buildMockSecret({ name: 'my-secret' }) });

    expect(screen.getByTestId('error-alert')).toHaveTextContent('Failed to load secret contents');
    expect(screen.getByTestId('error-alert').closest('footer')).toContainElement(
      screen.getByTestId('secret-modal-submit-button'),
    );
    expect(screen.queryByText('Loading secret data...')).not.toBeInTheDocument();
    expect(screen.getByTestId('secret-modal-submit-button')).toBeDisabled();
  });

  it('keeps showing the load error over a validation error and a failed submit', async () => {
    const user = userEvent.setup();
    mockSecretLoad(new Error('forbidden'));
    mockCreateSecret.mockRejectedValueOnce(new Error('secret already exists'));
    renderModal();

    // Empty form: validation blocks the submit, but the load error is still the one shown
    await user.click(screen.getByTestId('secret-modal-submit-button'));
    expect(screen.getByTestId('error-alert')).toHaveTextContent('Failed to load secret contents');
    expect(screen.getByTestId('error-alert')).not.toHaveTextContent('Secret name is required');
    expect(mockCreateSecret).not.toHaveBeenCalled();

    // Valid form: the API rejects the create, and the load error still takes priority
    await user.type(screen.getByTestId('secret-name-input'), 'my-secret');
    await fillKeyValuePair(user);
    await user.click(screen.getByTestId('secret-modal-submit-button'));
    await waitFor(() => expect(screen.getByTestId('secret-modal-submit-button')).toBeEnabled());
    expect(mockCreateSecret).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('error-alert')).toHaveTextContent('Failed to load secret contents');
    expect(screen.getByTestId('error-alert')).not.toHaveTextContent('secret already exists');
  });
});

const mockUseNotebookAPI = useNotebookAPI as jest.MockedFunction<typeof useNotebookAPI>;

const secretToEdit: SecretsSecretListItem = {
  name: 'db-credentials',
  canMount: true,
  canUpdate: true,
  audit: { createdAt: '', createdBy: '', updatedAt: '', updatedBy: '', deletedAt: '' },
};

describe('SecretsCreateModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSecret.mockReturnValue([
      { keyValuePairs: [], immutable: false, type: 'Opaque' },
      true,
      undefined,
      jest.fn(),
    ]);
  });

  it('creates the secret in the namespace passed by the workspace form, not a global namespace selector', async () => {
    const user = userEvent.setup();
    const createSecret = jest.fn().mockResolvedValue({});
    mockUseNotebookAPI.mockReturnValue({
      api: { secrets: { createSecret } } as unknown as NotebookApis,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });

    render(<SecretsCreateModal isOpen setIsOpen={jest.fn()} namespace="workspace-namespace" />);

    await user.type(screen.getByTestId('secret-name-input'), 'my-secret');
    await user.type(screen.getByTestId('key-input'), 'API_KEY');
    await user.type(screen.getByTestId('value-input'), 'super-secret-value');
    await user.click(screen.getByTestId('secret-modal-submit-button'));

    expect(createSecret).toHaveBeenCalledWith(
      'workspace-namespace',
      expect.objectContaining({ data: expect.objectContaining({ name: 'my-secret' }) }),
    );
  });

  it('fetches the secret to edit using the namespace passed by the workspace form', () => {
    mockUseNotebookAPI.mockReturnValue({
      api: {} as NotebookApis,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });

    render(
      <SecretsCreateModal
        isOpen
        setIsOpen={jest.fn()}
        namespace="workspace-namespace"
        secretToEdit={secretToEdit}
      />,
    );

    expect(useSecret).toHaveBeenCalledWith(
      expect.objectContaining({ namespace: 'workspace-namespace', secretName: 'db-credentials' }),
    );
  });

  it('updates the secret in the namespace passed by the workspace form, not a global namespace selector', async () => {
    const user = userEvent.setup();
    const updateSecret = jest.fn().mockResolvedValue({});
    mockUseNotebookAPI.mockReturnValue({
      api: { secrets: { updateSecret } } as unknown as NotebookApis,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });
    mockUseSecret.mockReturnValue([
      {
        keyValuePairs: [{ key: 'API_KEY', value: 'old-value' }],
        immutable: false,
        type: 'Opaque',
      },
      true,
      undefined,
      jest.fn(),
    ]);

    render(
      <SecretsCreateModal
        isOpen
        setIsOpen={jest.fn()}
        namespace="workspace-namespace"
        secretToEdit={secretToEdit}
      />,
    );

    await user.click(screen.getByTestId('secret-modal-submit-button'));

    expect(updateSecret).toHaveBeenCalledWith(
      'workspace-namespace',
      'db-credentials',
      expect.objectContaining({ data: expect.any(Object) }),
    );
  });
});
