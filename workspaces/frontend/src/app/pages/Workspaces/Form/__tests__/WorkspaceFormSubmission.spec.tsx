import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { WorkspaceForm } from '~/app/pages/Workspaces/Form/WorkspaceForm';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { NotebookApis } from '~/shared/api/notebookApi';
import { buildMockWorkspaceKind, buildMockWorkspaceUpdate } from '~/shared/mock/mockBuilder';

const mockNavigate = jest.fn();
const mockSuccess = jest.fn();

jest.mock('mod-arch-core', () => ({
  ...jest.requireActual('mod-arch-core'),
  useNotification: () => ({ success: mockSuccess }),
}));
jest.mock('~/app/routerHelper', () => ({ useTypedNavigate: () => mockNavigate }));
jest.mock('~/app/hooks/useNotebookAPI', () => ({ useNotebookAPI: jest.fn() }));
jest.mock('~/app/hooks/useWorkspaceFormLocationData', () => ({
  useWorkspaceFormLocationData: () => ({
    mode: 'update',
    namespace: 'team-a',
    workspaceName: 'research-notebook',
    workspaceKindName: 'jupyterlab',
  }),
}));
jest.mock('~/app/pages/Workspaces/Form/properties/WorkspaceFormPropertiesVolumes', () => ({
  WorkspaceFormPropertiesVolumes: () => null,
}));
jest.mock('~/app/pages/Workspaces/Form/properties/WorkspaceFormPropertiesSecrets', () => ({
  WorkspaceFormPropertiesSecrets: () => null,
}));

describe('WorkspaceForm submission with the real loader and payload builder', () => {
  const getWorkspace = jest.fn();
  const updateWorkspace = jest.fn();
  const kind = buildMockWorkspaceKind({});
  const options = {
    imageConfig: {
      default: 'image-1',
      values: [
        { ...kind.podTemplate.options.imageConfig.values![0], id: 'image-1', redirect: undefined },
      ],
    },
    podConfig: {
      default: 'pod-1',
      values: [
        { ...kind.podTemplate.options.podConfig.values![0], id: 'pod-1', redirect: undefined },
      ],
    },
  };
  const currentState = buildMockWorkspaceUpdate({
    displayName: 'Research notebook',
    revision: 'opaque/stale:17',
    paused: true,
    podTemplate: {
      podMetadata: {
        labels: { team: 'research' },
        annotations: { 'example.org/owner': 'notebooks' },
      },
      options: { imageConfig: 'image-1', podConfig: 'pod-1' },
      volumes: {
        home: 'home-pvc',
        data: [{ pvcName: 'data-pvc', mountPath: '/data', readOnly: true }],
        secrets: [{ secretName: 'credentials', mountPath: '/credentials', defaultMode: 256 }],
      },
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    getWorkspace.mockResolvedValue({ data: currentState });
    updateWorkspace.mockResolvedValue({ data: currentState });
    jest.mocked(useNotebookAPI).mockReturnValue({
      api: {
        workspaces: { getWorkspace, updateWorkspace },
        workspaceKinds: {
          listWorkspaceKinds: jest.fn().mockResolvedValue({ data: [kind] }),
          podTemplateOptionsListValues: jest.fn().mockResolvedValue({ data: options }),
        },
      } as unknown as NotebookApis,
      apiAvailable: true,
      refreshAllAPI: jest.fn(),
    });
  });

  const advanceToProperties = async (user: ReturnType<typeof userEvent.setup>) => {
    await screen.findByTestId('workspace-form-title');
    for (let step = 0; step < 3; step += 1) {
      await waitFor(() => expect(screen.getByTestId('next-button')).toBeEnabled());
      await user.click(screen.getByTestId('next-button'));
    }
    await screen.findByTestId('workspace-display-name');
  };

  it.each([false, true])(
    'preserves configuration from GET when saving (rename: %s)',
    async (rename) => {
      const user = userEvent.setup();
      render(<WorkspaceForm />);
      await advanceToProperties(user);
      expect(screen.getByTestId('workspace-display-name')).toHaveValue('Research notebook');
      if (rename) {
        await user.clear(screen.getByTestId('workspace-display-name'));
        expect(screen.getByText('Value is required')).toBeVisible();
        expect(screen.getByTestId('next-button')).toBeDisabled();
        await user.type(screen.getByTestId('workspace-display-name'), 'Renamed notebook');
      }
      await user.click(screen.getByTestId('next-button'));
      await user.click(screen.getByTestId('submit-button'));

      await waitFor(() =>
        expect(updateWorkspace).toHaveBeenCalledWith('team-a', 'research-notebook', {
          data: {
            ...currentState,
            displayName: rename ? 'Renamed notebook' : currentState.displayName,
            paused: false,
          },
        }),
      );
      expect(getWorkspace).toHaveBeenCalledWith('team-a', 'research-notebook');
      expect(mockNavigate).toHaveBeenCalledWith('workspaces');
      expect(mockSuccess).toHaveBeenCalledWith(expect.stringContaining('updated successfully'));
    },
  );

  it('keeps a stale-revision failure visible without navigating or replacing the revision', async () => {
    updateWorkspace.mockRejectedValue({
      error: { code: '409', message: 'Workspace revision is stale. Reload before saving.' },
    });
    const user = userEvent.setup();
    render(<WorkspaceForm />);
    await advanceToProperties(user);
    await user.click(screen.getByTestId('next-button'));
    await user.click(screen.getByTestId('submit-button'));

    expect(await screen.findByTestId('workspace-form-error')).toHaveTextContent(
      'Workspace revision is stale. Reload before saving.',
    );
    expect(screen.getByTestId('submit-button')).toBeEnabled();
    expect(updateWorkspace).toHaveBeenCalledTimes(1);
    expect(updateWorkspace.mock.calls[0][2].data.revision).toBe(currentState.revision);
    expect(getWorkspace).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockSuccess).not.toHaveBeenCalled();
  });
});
