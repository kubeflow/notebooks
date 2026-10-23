import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import {
  useWorkspaceActionsContext,
  WorkspaceActionsContextProvider,
} from '~/app/context/WorkspaceActionsContext';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { useNamespaceSelectorWrapper } from '~/app/hooks/useNamespaceSelectorWrapper';
import { NotebookApis } from '~/shared/api/notebookApi';
import {
  buildImageRedirectChain,
  buildMockWorkspace,
  buildMockWorkspaceUpdateFromWorkspace,
} from '~/shared/mock/mockBuilder';
import { WorkspacesWorkspaceListItem } from '~/generated/data-contracts';

jest.mock('~/app/hooks/useNotebookAPI', () => ({ useNotebookAPI: jest.fn() }));
jest.mock('~/app/hooks/useNamespaceSelectorWrapper', () => ({
  useNamespaceSelectorWrapper: jest.fn(),
}));
jest.mock('~/app/routerHelper', () => ({ useTypedNavigate: () => jest.fn() }));
jest.mock('~/app/pages/Workspaces/Details/WorkspaceDetails', () => ({
  WorkspaceDetails: () => null,
}));
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
    <button
      type="button"
      data-testid="confirm-delete"
      data-namespace={namespace}
      onClick={onDelete}
    >
      Confirm delete {resourceName}
    </button>
  ),
}));
jest.mock('mod-arch-core', () => ({
  ...jest.requireActual('mod-arch-core'),
  useNotification: () => ({ info: jest.fn() }),
}));

const workspaceName = 'shared-name';
const namespaceA = 'namespace-a';
const namespaceB = 'namespace-b';

const WorkspaceActionTriggers: React.FC<{
  workspaces: WorkspacesWorkspaceListItem[];
  action: 'start' | 'stop';
}> = ({ workspaces, action }) => {
  const { requestStartAction, requestStopAction } = useWorkspaceActionsContext();

  return (
    <>
      {workspaces.map((workspace) => (
        <button
          key={workspace.namespace}
          type="button"
          onClick={() =>
            (action === 'start' ? requestStartAction : requestStopAction)({ workspace })
          }
        >
          {`${action} ${workspace.namespace}/${workspace.name}`}
        </button>
      ))}
    </>
  );
};

const DeleteActionTrigger: React.FC<{ workspace: WorkspacesWorkspaceListItem }> = ({
  workspace,
}) => {
  const { requestDeleteAction } = useWorkspaceActionsContext();

  return (
    <button
      type="button"
      data-testid="trigger-delete"
      onClick={() => requestDeleteAction({ workspace })}
    >
      trigger delete
    </button>
  );
};

describe('WorkspaceActionsContext namespace routing', () => {
  const updateWorkspacePauseState = jest.fn();
  const getWorkspace = jest.fn();
  const updateWorkspace = jest.fn();
  const deleteWorkspace = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useNamespaceSelectorWrapper).mockReturnValue({
      selectedNamespace: namespaceA,
    } as ReturnType<typeof useNamespaceSelectorWrapper>);
    jest.mocked(useNotebookAPI).mockReturnValue({
      api: {
        workspaces: { updateWorkspacePauseState, getWorkspace, updateWorkspace, deleteWorkspace },
      } as unknown as NotebookApis,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });
    updateWorkspacePauseState.mockResolvedValue({ data: { paused: false } });
    updateWorkspace.mockResolvedValue({});
    deleteWorkspace.mockResolvedValue({});
  });

  it.each([
    { action: 'start' as const, button: 'start-button', paused: false },
    { action: 'stop' as const, button: 'stop-button', paused: true },
    { action: 'start' as const, button: 'update-and-start-button', paused: false },
    { action: 'stop' as const, button: 'update-and-stop-button', paused: true },
  ])(
    'uses the chosen workspace namespace for $button when names match',
    async ({ action, button, paused }) => {
      const user = userEvent.setup();
      const workspaceInA = buildMockWorkspace({ name: workspaceName, namespace: namespaceA });
      const workspaceInB = buildMockWorkspace({
        name: workspaceName,
        namespace: namespaceB,
        podTemplate: {
          ...workspaceInA.podTemplate,
          options: {
            ...workspaceInA.podTemplate.options,
            imageConfig: {
              ...workspaceInA.podTemplate.options.imageConfig,
              redirectChain: buildImageRedirectChain({
                startVersion: '1.8.0',
                endVersion: '1.9.0',
              }),
            },
          },
        },
      });
      const currentState = buildMockWorkspaceUpdateFromWorkspace({ workspace: workspaceInB });
      getWorkspace.mockResolvedValue({ data: currentState });

      render(
        <WorkspaceActionsContextProvider>
          <WorkspaceActionTriggers workspaces={[workspaceInA, workspaceInB]} action={action} />
        </WorkspaceActionsContextProvider>,
      );

      await user.click(
        screen.getByRole('button', { name: `${action} ${namespaceB}/${workspaceName}` }),
      );
      await user.click(screen.getByTestId(button));

      if (button.startsWith('update-and')) {
        await waitFor(() => {
          expect(getWorkspace).toHaveBeenCalledWith(namespaceB, workspaceName);
          expect(updateWorkspace).toHaveBeenCalledWith(
            namespaceB,
            workspaceName,
            expect.objectContaining({ data: expect.objectContaining({ paused }) }),
          );
        });
        expect(updateWorkspacePauseState).not.toHaveBeenCalled();
      } else {
        await waitFor(() => {
          expect(updateWorkspacePauseState).toHaveBeenCalledWith(namespaceB, workspaceName, {
            data: { paused },
          });
        });
        expect(getWorkspace).not.toHaveBeenCalled();
        expect(updateWorkspace).not.toHaveBeenCalled();
      }
    },
  );

  it('shows a stop error for the chosen namespace without retrying the matching workspace elsewhere', async () => {
    const user = userEvent.setup();
    const workspaceInA = buildMockWorkspace({ name: workspaceName, namespace: namespaceA });
    const workspaceInB = buildMockWorkspace({ name: workspaceName, namespace: namespaceB });
    updateWorkspacePauseState.mockRejectedValue(new Error('stop failed'));

    render(
      <WorkspaceActionsContextProvider>
        <WorkspaceActionTriggers workspaces={[workspaceInA, workspaceInB]} action="stop" />
      </WorkspaceActionsContextProvider>,
    );

    await user.click(screen.getByRole('button', { name: `stop ${namespaceB}/${workspaceName}` }));
    await user.click(screen.getByTestId('stop-button'));

    expect(await screen.findByTestId('stop-modal-error-message')).toHaveTextContent('stop failed');
    expect(updateWorkspacePauseState).toHaveBeenCalledTimes(1);
    expect(updateWorkspacePauseState).toHaveBeenCalledWith(namespaceB, workspaceName, {
      data: { paused: true },
    });
  });

  describe('Delete action namespace handling (#1413)', () => {
    it('deletes a workspace whose namespace matches the selected namespace', async () => {
      const user = userEvent.setup();
      const workspace = buildMockWorkspace({ name: 'my-notebook-1', namespace: namespaceA });

      render(
        <WorkspaceActionsContextProvider>
          <DeleteActionTrigger workspace={workspace} />
        </WorkspaceActionsContextProvider>,
      );

      await user.click(screen.getByTestId('trigger-delete'));
      await user.click(await screen.findByTestId('confirm-delete'));

      await waitFor(() => {
        expect(deleteWorkspace).toHaveBeenCalledWith(namespaceA, workspace.name);
      });
    });

    it('deletes a workspace using its own namespace when it differs from the selected namespace', async () => {
      const user = userEvent.setup();
      const workspace = buildMockWorkspace({ name: 'my-notebook-2', namespace: namespaceB });

      render(
        <WorkspaceActionsContextProvider>
          <DeleteActionTrigger workspace={workspace} />
        </WorkspaceActionsContextProvider>,
      );

      await user.click(screen.getByTestId('trigger-delete'));
      await user.click(await screen.findByTestId('confirm-delete'));

      await waitFor(() => {
        expect(deleteWorkspace).toHaveBeenCalledWith(namespaceB, workspace.name);
        expect(deleteWorkspace).not.toHaveBeenCalledWith(namespaceA, workspace.name);
      });
    });

    it('passes the workspace namespace into the Delete modal', async () => {
      const user = userEvent.setup();
      const workspace = buildMockWorkspace({ name: 'my-notebook-3', namespace: namespaceB });

      render(
        <WorkspaceActionsContextProvider>
          <DeleteActionTrigger workspace={workspace} />
        </WorkspaceActionsContextProvider>,
      );

      await user.click(screen.getByTestId('trigger-delete'));

      expect(await screen.findByTestId('confirm-delete')).toHaveAttribute(
        'data-namespace',
        namespaceB,
      );
    });

    it('does not delete before confirmation', async () => {
      const user = userEvent.setup();
      const workspace = buildMockWorkspace({ name: 'my-notebook-4', namespace: namespaceB });

      render(
        <WorkspaceActionsContextProvider>
          <DeleteActionTrigger workspace={workspace} />
        </WorkspaceActionsContextProvider>,
      );

      await user.click(screen.getByTestId('trigger-delete'));

      expect(deleteWorkspace).not.toHaveBeenCalled();
    });
  });
});
