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

const mockUseAppContext = jest.mocked(useAppContext);
const mockUseWorkspaceKinds = jest.mocked(useWorkspaceKinds);
const mockUseWorkspaceCountPerKind = jest.mocked(useWorkspaceCountPerKind);

describe('WorkspaceKinds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the restricted-access message for non-admin users', () => {
    mockUseAppContext.mockReturnValue({
      config: null,
      user: { userId: 'kubeflow-user', clusterAdmin: false },
    });

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
  });

  it('does not fire data hooks for non-admin users', () => {
    mockUseAppContext.mockReturnValue({
      config: null,
      user: { userId: 'kubeflow-user', clusterAdmin: false },
    });

    render(<WorkspaceKinds />);

    expect(mockUseWorkspaceKinds).not.toHaveBeenCalled();
    expect(mockUseWorkspaceCountPerKind).not.toHaveBeenCalled();
  });

  it('shows the restricted-access message when user context is not yet loaded', () => {
    mockUseAppContext.mockReturnValue({ config: null, user: null });

    render(<WorkspaceKinds />);

    expect(screen.getByTestId('workspace-kinds-access-empty-state')).toBeInTheDocument();
    expect(mockUseWorkspaceKinds).not.toHaveBeenCalled();
    expect(mockUseWorkspaceCountPerKind).not.toHaveBeenCalled();
  });
});
