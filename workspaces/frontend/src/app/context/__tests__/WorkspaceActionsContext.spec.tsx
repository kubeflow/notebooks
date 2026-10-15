import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  WorkspaceActionsContextProvider,
  useWorkspaceActionsContext,
} from '~/app/context/WorkspaceActionsContext';
import { WorkspacesWorkspaceListItem } from '~/generated/data-contracts';
import { buildMockWorkspace } from '~/shared/mock/mockBuilder';

const mockDeleteWorkspace = jest.fn().mockResolvedValue({});
const mockNotificationInfo = jest.fn();
const mockNavigate = jest.fn();

jest.mock('~/app/hooks/useNotebookAPI', () => ({
  useNotebookAPI: () => ({
    api: {
      workspaces: {
        deleteWorkspace: mockDeleteWorkspace,
        updateWorkspacePauseState: jest.fn(),
        getWorkspace: jest.fn(),
        updateWorkspace: jest.fn(),
      },
    },
  }),
}));

jest.mock('mod-arch-core', () => ({
  useNotification: () => ({ info: mockNotificationInfo }),
}));

jest.mock('~/app/routerHelper', () => ({
  useTypedNavigate: () => mockNavigate,
}));

// This mock represents whichever namespace the ADMIN currently has
// selected at the page level (e.g. the dropdown at the top of the UI).
let mockSelectedNamespace = 'admin-selected-namespace';
jest.mock('~/app/hooks/useNamespaceSelectorWrapper', () => ({
  useNamespaceSelectorWrapper: () => ({ selectedNamespace: mockSelectedNamespace }),
}));

// Stub DeleteModal down to a single confirm button, exposing the
// namespace prop it was given so we can assert on it directly.
jest.mock('~/shared/components/DeleteModal', () => ({
  __esModule: true,
  default: ({
    onDelete,
    resourceName,
    namespace,
  }: {
    onDelete: () => void;
    resourceName: string;
    namespace: string;
  }) => (
    <button data-testid="confirm-delete" data-namespace={namespace} onClick={onDelete}>
      Confirm delete {resourceName}
    </button>
  ),
}));

jest.mock('~/app/pages/Workspaces/Details/WorkspaceDetails', () => ({
  WorkspaceDetails: () => null,
}));
jest.mock('~/app/pages/Workspaces/workspaceActions/WorkspaceStartActionModal', () => ({
  WorkspaceStartActionModal: () => null,
}));
jest.mock('~/app/pages/Workspaces/workspaceActions/WorkspaceStopActionModal', () => ({
  WorkspaceStopActionModal: () => null,
}));

const TestConsumer: React.FC<{ workspace: WorkspacesWorkspaceListItem }> = ({ workspace }) => {
  const { requestDeleteAction } = useWorkspaceActionsContext();
  return (
    <button data-testid="trigger-delete" onClick={() => requestDeleteAction({ workspace })}>
      trigger delete
    </button>
  );
};

describe('WorkspaceActionsContextProvider - delete action namespace handling (#1413)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSelectedNamespace = 'admin-selected-namespace';
  });

  it('deletes a workspace whose namespace matches the admin-selected namespace', async () => {
    const workspace = buildMockWorkspace({
      name: 'my-notebook-1',
      namespace: 'admin-selected-namespace',
    });

    render(
      <WorkspaceActionsContextProvider>
        <TestConsumer workspace={workspace} />
      </WorkspaceActionsContextProvider>,
    );

    fireEvent.click(screen.getByTestId('trigger-delete'));
    fireEvent.click(await screen.findByTestId('confirm-delete'));

    await waitFor(() => {
      expect(mockDeleteWorkspace).toHaveBeenCalledWith('admin-selected-namespace', 'my-notebook-1');
    });
  });

  it('deletes a workspace using its OWN namespace even when it differs from the admin-selected namespace', async () => {
    const workspace = buildMockWorkspace({
      name: 'my-notebook-2',
      namespace: 'example-profile-2',
    });

    render(
      <WorkspaceActionsContextProvider>
        <TestConsumer workspace={workspace} />
      </WorkspaceActionsContextProvider>,
    );

    fireEvent.click(screen.getByTestId('trigger-delete'));
    fireEvent.click(await screen.findByTestId('confirm-delete'));

    await waitFor(() => {
      // The fix: must use the workspace's own namespace, never the
      // admin's currently-selected page namespace.
      expect(mockDeleteWorkspace).toHaveBeenCalledWith('example-profile-2', 'my-notebook-2');
      expect(mockDeleteWorkspace).not.toHaveBeenCalledWith(
        'admin-selected-namespace',
        'my-notebook-2',
      );
    });
  });

  it("passes the workspace's own namespace into the DeleteModal for display", async () => {
    const workspace = buildMockWorkspace({
      name: 'my-notebook-3',
      namespace: 'example-profile-3',
    });

    render(
      <WorkspaceActionsContextProvider>
        <TestConsumer workspace={workspace} />
      </WorkspaceActionsContextProvider>,
    );

    fireEvent.click(screen.getByTestId('trigger-delete'));
    const confirmButton = await screen.findByTestId('confirm-delete');

    expect(confirmButton.getAttribute('data-namespace')).toBe('example-profile-3');
  });

  it('does not call deleteWorkspace before the admin confirms in the modal', () => {
    const workspace = buildMockWorkspace({
      name: 'my-notebook-4',
      namespace: 'example-profile-4',
    });

    render(
      <WorkspaceActionsContextProvider>
        <TestConsumer workspace={workspace} />
      </WorkspaceActionsContextProvider>,
    );

    fireEvent.click(screen.getByTestId('trigger-delete'));

    expect(mockDeleteWorkspace).not.toHaveBeenCalled();
  });
});
