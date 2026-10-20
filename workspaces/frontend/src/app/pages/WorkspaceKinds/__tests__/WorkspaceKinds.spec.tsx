import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { WorkspaceKinds } from '~/app/pages/WorkspaceKinds/WorkspaceKinds';
import { useAppContext } from '~/app/context/AppContext';
import useWorkspaceKinds from '~/app/hooks/useWorkspaceKinds';
import { useWorkspaceCountPerKind } from '~/app/hooks/useWorkspaceCountPerKind';
import { buildAxiosError } from '~/shared/mock/mockUtils';

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

  it('fires data hooks and renders admin view for clusterAdmin users', () => {
    mockUseAppContext.mockReturnValue({
      config: null,
      user: { userId: 'admin-user', clusterAdmin: true },
    });

    mockUseWorkspaceKinds.mockReturnValue([[], true, undefined, jest.fn()]);
    mockUseWorkspaceCountPerKind.mockReturnValue({
      workspaceCountPerKind: {},
      error: null,
    });

    render(
      <MemoryRouter>
        <WorkspaceKinds />
      </MemoryRouter>,
    );

    expect(mockUseWorkspaceKinds).toHaveBeenCalled();
    expect(mockUseWorkspaceCountPerKind).toHaveBeenCalled();

    expect(screen.queryByTestId('workspace-kinds-access-empty-state')).not.toBeInTheDocument();
  });

  it('renders the empty state inside a table body for admin users', () => {
    mockUseAppContext.mockReturnValue({
      config: null,
      user: { userId: 'admin-user', clusterAdmin: true },
    });

    mockUseWorkspaceKinds.mockReturnValue([[], true, undefined, jest.fn()]);
    mockUseWorkspaceCountPerKind.mockReturnValue({
      workspaceCountPerKind: {},
      error: null,
    });

    render(
      <MemoryRouter>
        <WorkspaceKinds />
      </MemoryRouter>,
    );

    const emptyState = screen.getByTestId('empty-state');
    expect(emptyState.closest('tbody')).toBeInTheDocument();
  });

  it('shows the restricted-access message when the workspace kinds request returns 403', () => {
    mockUseAppContext.mockReturnValue({
      config: null,
      user: { userId: 'admin-user', clusterAdmin: true },
    });

    mockUseWorkspaceKinds.mockReturnValue([
      [],
      false,
      buildAxiosError({ error: { code: 'forbidden', message: 'Forbidden' } }, 403),
      jest.fn(),
    ]);

    render(
      <MemoryRouter>
        <WorkspaceKinds />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('workspace-kinds-access-empty-state')).toBeInTheDocument();
    expect(
      screen.getByText('WorkspaceKind management is restricted to administrators'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Failed to load workspace kinds')).not.toBeInTheDocument();
  });

  it('shows the load error when the workspace kinds request fails for another reason', () => {
    mockUseAppContext.mockReturnValue({
      config: null,
      user: { userId: 'admin-user', clusterAdmin: true },
    });

    mockUseWorkspaceKinds.mockReturnValue([
      [],
      false,
      buildAxiosError({ error: { code: 'internal_error', message: 'Server error' } }, 500),
      jest.fn(),
    ]);

    render(
      <MemoryRouter>
        <WorkspaceKinds />
      </MemoryRouter>,
    );

    expect(screen.getByText('Failed to load workspace kinds')).toBeInTheDocument();
    expect(screen.queryByTestId('workspace-kinds-access-empty-state')).not.toBeInTheDocument();
  });

  it('shows the restricted-access message when user context is not yet loaded', () => {
    mockUseAppContext.mockReturnValue({ config: null, user: null });

    render(<WorkspaceKinds />);

    expect(screen.getByTestId('workspace-kinds-access-empty-state')).toBeInTheDocument();
    expect(mockUseWorkspaceKinds).not.toHaveBeenCalled();
    expect(mockUseWorkspaceCountPerKind).not.toHaveBeenCalled();
  });
});
