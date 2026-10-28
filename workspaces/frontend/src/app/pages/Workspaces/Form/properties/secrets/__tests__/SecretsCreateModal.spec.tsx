import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import useSecret, { SecretDetails } from '~/app/hooks/useSecret';
import { buildMockSecret } from '~/shared/mock/mockBuilder';
import { SecretsCreateModal } from '~/app/pages/Workspaces/Form/properties/secrets/SecretsCreateModal';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { NotebookApis } from '~/shared/api/notebookApi';
import { SecretsSecretListItem, V1SecretType } from '~/generated/data-contracts';

const mockCreateSecret = jest.fn();

jest.mock('mod-arch-kubeflow', () => ({
  useThemeContext: () => ({ isMUITheme: false }),
}));

jest.mock('~/app/hooks/useNotebookAPI', () => ({
  useNotebookAPI: jest.fn(() => ({
    api: { secrets: { createSecret: mockCreateSecret, updateSecret: jest.fn() } },
  })),
}));

jest.mock('~/app/hooks/useNamespaceSelectorWrapper', () => ({
  useNamespaceSelectorWrapper: () => ({ selectedNamespace: 'default' }),
}));

jest.mock('~/app/hooks/useSecret', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockUseSecret = useSecret as jest.MockedFunction<typeof useSecret>;

const EMPTY_SECRET: SecretDetails = {
  keyValuePairs: [],
  immutable: false,
  type: V1SecretType.SecretTypeOpaque,
};

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

describe('editing undisclosed secret data', () => {
  const updateSecret = jest.fn();
  const details: SecretDetails = {
    keyValuePairs: [
      { key: 'username', kind: 'unchanged' },
      { key: 'password', kind: 'unchanged' },
    ],
    immutable: false,
    type: V1SecretType.SecretTypeBasicAuth,
  };
  const editSecret = buildMockSecret({ name: 'db-credentials' });
  const renderEditor = (props: Partial<React.ComponentProps<typeof SecretsCreateModal>> = {}) =>
    renderModal({ secretToEdit: editSecret, namespace: 'workspace-namespace', ...props });
  const expectUpdate = (contents: Record<string, { base64?: string }>) =>
    expect(updateSecret).toHaveBeenLastCalledWith('workspace-namespace', 'db-credentials', {
      data: { type: V1SecretType.SecretTypeBasicAuth, immutable: false, contents },
    });

  beforeEach(() => {
    updateSecret.mockReset().mockResolvedValue({});
    mockUseNotebookAPI.mockReturnValue({
      api: { secrets: { updateSecret } } as unknown as NotebookApis,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });
    mockUseSecret.mockReturnValue([details, true, undefined, jest.fn()]);
  });

  it('saves undisclosed keys as empty objects and preserves the fetched type and immutable state', async () => {
    const user = userEvent.setup();
    const onSecretUpdated = jest.fn();
    const setIsOpen = jest.fn();
    renderEditor({ onSecretUpdated, setIsOpen });
    expect(screen.getAllByTestId('undisclosed-value')).toHaveLength(2);
    expect(screen.queryByTestId('value-input')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('key-input')[0]).toHaveAttribute('readonly');
    expect(screen.getByTestId('secret-type-select')).toHaveTextContent('kubernetes.io/basic-auth');
    await user.click(screen.getByTestId('secret-modal-submit-button'));
    expectUpdate({ username: {}, password: {} });
    expect(onSecretUpdated).toHaveBeenCalledWith('db-credentials');
    expect(setIsOpen).toHaveBeenCalledWith(false);
  });

  it.each(['new-password', '日本語🔑 café'])(
    'replaces one value with UTF-8 text: %s',
    async (text) => {
      const user = userEvent.setup();
      renderEditor();
      await user.click(screen.getAllByTestId('replace-secret-value')[1]);
      expect(screen.getByTestId('value-input')).toHaveValue('');
      await user.click(screen.getByTestId('secret-modal-submit-button'));
      expect(screen.getByTestId('error-alert')).toHaveTextContent('Value is required (pair 2)');
      expect(updateSecret).not.toHaveBeenCalled();
      await user.type(screen.getByTestId('value-input'), text);
      expect(screen.queryByTestId('error-alert')).not.toBeInTheDocument();
      await user.click(screen.getByTestId('secret-modal-submit-button'));
      expectUpdate({
        username: {},
        password: { base64: Buffer.from(text, 'utf8').toString('base64') },
      });
    },
  );

  it('discards replacement text when Keep existing value is selected', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getAllByTestId('replace-secret-value')[0]);
    await user.type(screen.getByTestId('value-input'), 'discarded-text');
    await user.click(screen.getByTestId('keep-secret-value'));
    expect(screen.queryByTestId('value-input')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('secret-modal-submit-button'));
    expectUpdate({ username: {}, password: {} });
  });

  it('can mark a mutable secret immutable while keeping its undisclosed values', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getByTestId('secret-immutable-switch'));
    await user.click(screen.getByTestId('secret-modal-submit-button'));
    expect(updateSecret).toHaveBeenCalledWith('workspace-namespace', 'db-credentials', {
      data: {
        type: V1SecretType.SecretTypeBasicAuth,
        immutable: true,
        contents: { username: {}, password: {} },
      },
    });
  });

  it.each([1, 2])('omits deleted keys, including deleting all %i existing keys', async (count) => {
    const user = userEvent.setup();
    renderEditor();
    for (let i = 0; i < count; i++) {
      await user.click(screen.getAllByTestId('remove-key-value-pair')[0]);
    }
    await user.click(screen.getByTestId('secret-modal-submit-button'));
    expectUpdate(count === 1 ? { password: {} } : {});
  });

  it('requires text for a deleted and re-added key instead of silently preserving it', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getAllByTestId('remove-key-value-pair')[1]);
    await user.click(screen.getByTestId('another-key-value-pair-button'));
    await user.type(screen.getAllByTestId('key-input')[1], 'password');
    await user.click(screen.getByTestId('secret-modal-submit-button'));
    expect(screen.getByTestId('error-alert')).toHaveTextContent('Value is required (pair 2)');
    expect(updateSecret).not.toHaveBeenCalled();
    await user.type(screen.getByTestId('value-input'), 'replacement');
    await user.click(screen.getByTestId('secret-modal-submit-button'));
    expectUpdate({ username: {}, password: { base64: btoa('replacement') } });
  });

  it('rejects duplicate keys and permits correction before saving', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getByTestId('another-key-value-pair-button'));
    const keyInput = screen.getAllByTestId('key-input')[2];
    await user.type(keyInput, 'password');
    await user.type(screen.getByTestId('value-input'), 'new-text');
    await user.click(screen.getByTestId('secret-modal-submit-button'));
    expect(screen.getByTestId('error-alert')).toHaveTextContent('Duplicate keys are not allowed');
    expect(updateSecret).not.toHaveBeenCalled();
    await user.clear(keyInput);
    await user.type(keyInput, 'another-key');
    await user.click(screen.getByTestId('secret-modal-submit-button'));
    expectUpdate({ username: {}, password: {}, 'another-key': { base64: btoa('new-text') } });
  });

  it.each(['immutable', 'permission', 'load-error'])(
    'blocks editing and saving a non-editable secret: %s',
    async (reason) => {
      const user = userEvent.setup();
      mockUseSecret.mockReturnValue([
        { ...details, immutable: reason === 'immutable' },
        true,
        reason === 'load-error' ? new Error('forbidden') : undefined,
        jest.fn(),
      ]);
      renderEditor({ secretToEdit: { ...editSecret, canUpdate: reason !== 'permission' } });
      expect(screen.getByTestId('secret-modal-submit-button')).toBeDisabled();
      expect(screen.getByTestId('secret-immutable-switch')).toBeDisabled();
      expect(screen.getAllByTestId('replace-secret-value')[0]).toBeDisabled();
      expect(screen.getAllByTestId('remove-key-value-pair')[0]).toBeDisabled();
      expect(screen.getByTestId('another-key-value-pair-button')).toBeDisabled();
      await user.click(screen.getByTestId('secret-modal-submit-button'));
      expect(updateSecret).not.toHaveBeenCalled();
    },
  );

  it('allows correcting a failed save while keeping untouched keys undisclosed', async () => {
    const user = userEvent.setup();
    const onSecretUpdated = jest.fn();
    updateSecret.mockRejectedValueOnce(new Error('Conflict: retry with a corrected value'));
    renderEditor({ onSecretUpdated });
    await user.click(screen.getAllByTestId('replace-secret-value')[1]);
    await user.type(screen.getByTestId('value-input'), 'first-attempt');
    await user.click(screen.getByTestId('secret-modal-submit-button'));
    expect(await screen.findByTestId('error-alert')).toHaveTextContent('Conflict: retry');
    expect(onSecretUpdated).not.toHaveBeenCalled();
    expectUpdate({ username: {}, password: { base64: btoa('first-attempt') } });
    await user.clear(screen.getByTestId('value-input'));
    await user.type(screen.getByTestId('value-input'), 'corrected');
    expect(screen.queryByTestId('error-alert')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('secret-modal-submit-button'));
    expectUpdate({ username: {}, password: { base64: btoa('corrected') } });
    expect(updateSecret).toHaveBeenCalledTimes(2);
    expect(onSecretUpdated).toHaveBeenCalledTimes(1);
  });

  it('resets discarded text and errors when the editor is closed and reopened', async () => {
    const user = userEvent.setup();
    const props = { setIsOpen: jest.fn(), namespace: 'default', secretToEdit: editSecret };
    const { rerender } = render(<SecretsCreateModal isOpen {...props} />);
    await user.click(screen.getAllByTestId('replace-secret-value')[0]);
    await user.click(screen.getByTestId('secret-modal-submit-button'));
    expect(screen.getByTestId('error-alert')).toBeInTheDocument();
    await user.click(screen.getByTestId('secret-modal-cancel-button'));
    rerender(<SecretsCreateModal isOpen={false} {...props} />);
    rerender(<SecretsCreateModal isOpen {...props} />);
    expect(screen.queryByTestId('error-alert')).not.toBeInTheDocument();
    expect(screen.queryByTestId('value-input')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('undisclosed-value')).toHaveLength(2);
  });

  it('loads an existing empty secret without adding a required blank row', async () => {
    const user = userEvent.setup();
    mockUseSecret.mockReturnValue([{ ...details, keyValuePairs: [] }, true, undefined, jest.fn()]);
    renderEditor();
    expect(screen.queryByTestId('key-input')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('secret-modal-submit-button'));
    expectUpdate({});
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
      { keyValuePairs: [], immutable: false, type: V1SecretType.SecretTypeOpaque },
      true,
      undefined,
      jest.fn(),
    ]);
  });

  it('creates UTF-8 text including Japanese and emoji through the existing Base64 contract', async () => {
    const user = userEvent.setup();
    const createSecret = jest.fn().mockResolvedValue({});
    mockUseNotebookAPI.mockReturnValue({
      api: { secrets: { createSecret } } as unknown as NotebookApis,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });
    renderModal();
    await user.type(screen.getByTestId('secret-name-input'), 'unicode-secret');
    await user.type(screen.getByTestId('key-input'), 'message');
    await user.type(screen.getByTestId('value-input'), '日本語🔑 café');
    await user.click(screen.getByTestId('secret-modal-submit-button'));
    expect(createSecret).toHaveBeenCalledWith('default', {
      data: {
        name: 'unicode-secret',
        type: V1SecretType.SecretTypeOpaque,
        immutable: false,
        contents: { message: { base64: Buffer.from('日本語🔑 café', 'utf8').toString('base64') } },
      },
    });
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
        keyValuePairs: [{ key: 'API_KEY', kind: 'unchanged' }],
        immutable: false,
        type: V1SecretType.SecretTypeOpaque,
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
