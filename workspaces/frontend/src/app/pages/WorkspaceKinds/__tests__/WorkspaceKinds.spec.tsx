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

  it('shows the restricted-access message for non-admin users', () => {
    mockUseAppContext.mockReturnValue({
      config: null,
      user: { userId: 'kubeflow-user', clusterAdmin: false },
    });
    mockUseWorkspaceKinds.mockReturnValue([[], true, new Error('Forbidden'), jest.fn()]);

    render(<WorkspaceKinds />);

    expect(screen.getByTestId('workspace-kinds-access-empty-state')).toBeInTheDocument();
    expect(
      screen.getByText('WorkspaceKind management is restricted to administrators'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Please contact your admin if you need changes to workspace configurations.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Failed to load workspace kinds')).not.toBeInTheDocument();
  });

  it('does not fire data hooks for non-admin users', () => {
    mockUseAppContext.mockReturnValue({
      config: null,
      user: { userId: 'kubeflow-user', clusterAdmin: false },
    });
    mockUseWorkspaceKinds.mockReturnValue([[], true, undefined, jest.fn()]);

    render(<WorkspaceKinds />);

    expect(mockUseWorkspaceKinds).not.toHaveBeenCalled();
    expect(mockUseWorkspaceCountPerKind).not.toHaveBeenCalled();
  });
});
