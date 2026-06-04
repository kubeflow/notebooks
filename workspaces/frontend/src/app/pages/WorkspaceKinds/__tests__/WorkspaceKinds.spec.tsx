import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WorkspaceKinds } from '~/app/pages/WorkspaceKinds/WorkspaceKinds';
import { useAppContext } from '~/app/context/AppContext';
import useWorkspaceKinds from '~/app/hooks/useWorkspaceKinds';
import { useWorkspaceCountPerKind } from '~/app/hooks/useWorkspaceCountPerKind';

jest.mock('~/app/context/AppContext', () => ({
  useAppContext: jest.fn(),
}));

jest.mock('~/app/hooks/useWorkspaceKinds', () => jest.fn());

jest.mock('~/app/hooks/useWorkspaceCountPerKind', () => ({
  useWorkspaceCountPerKind: jest.fn(),
}));

jest.mock('~/app/routerHelper', () => ({
  useTypedNavigate: () => jest.fn(),
}));

const mockUseAppContext = useAppContext as jest.MockedFunction<typeof useAppContext>;
const mockUseWorkspaceKinds = useWorkspaceKinds as jest.MockedFunction<typeof useWorkspaceKinds>;
const mockUseWorkspaceCountPerKind = useWorkspaceCountPerKind as jest.MockedFunction<
  typeof useWorkspaceCountPerKind
>;

describe('WorkspaceKinds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseWorkspaceCountPerKind.mockReturnValue({ workspaceCountPerKind: {}, error: null });
  });

  it('shows a friendly message for users who cannot manage workspace kinds', () => {
    mockUseAppContext.mockReturnValue({
      config: null,
      user: { userId: 'kubeflow-user', clusterAdmin: false },
    });
    mockUseWorkspaceKinds.mockReturnValue([[], true, new Error('Forbidden'), jest.fn()]);

    render(<WorkspaceKinds />);

    expect(screen.getByTestId('workspace-kinds-access-empty-state')).toBeInTheDocument();
    expect(screen.getByText('Workspace kinds are managed by administrators')).toBeInTheDocument();
    expect(
      screen.getByText(
        'You do not have permission to manage workspace kinds. You can still create workspaces from the workspace kinds available to you.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Failed to load workspace kinds')).not.toBeInTheDocument();
  });
});
