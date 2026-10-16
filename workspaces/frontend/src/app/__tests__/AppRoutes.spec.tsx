import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import AppRoutes from '~/app/AppRoutes';
import { useAppContext } from '~/app/context/AppContext';
import { WorkspaceKindForm } from '~/app/pages/WorkspaceKinds/Form/WorkspaceKindForm';

jest.mock('~/app/context/AppContext', () => ({
  useAppContext: jest.fn(),
}));
jest.mock('~/app/pages/WorkspaceKinds/Form/WorkspaceKindForm', () => ({
  WorkspaceKindForm: jest.fn(() => <div data-testid="workspace-kind-form" />),
}));
jest.mock('~/app/pages/WorkspaceKinds/WorkspaceKinds', () => ({
  WorkspaceKinds: () => null,
}));
jest.mock('~/app/pages/WorkspaceKinds/summary/WorkspaceKindSummaryWrapper', () => ({
  WorkspaceKindSummaryWrapper: () => null,
}));
jest.mock('~/app/pages/Workspaces/WorkspacesWrapper', () => ({
  WorkspacesWrapper: () => null,
}));
jest.mock('~/app/pages/Workspaces/Form/WorkspaceForm', () => ({
  WorkspaceForm: () => null,
}));
jest.mock('~/app/pages/Debug/Debug', () => ({
  Debug: () => null,
}));
jest.mock('~/app/pages/notFound/NotFound', () => ({
  NotFound: () => null,
}));

const mockUseAppContext = jest.mocked(useAppContext);
const mockWorkspaceKindForm = jest.mocked(WorkspaceKindForm);

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );

const expectRestrictedAccess = () => {
  expect(screen.getByTestId('workspace-kinds-access-empty-state')).toBeInTheDocument();
  expect(
    screen.getByText('WorkspaceKind management is restricted to administrators'),
  ).toBeInTheDocument();
  expect(
    screen.getByText('Please contact your admin if you need changes to workspace configurations.'),
  ).toBeInTheDocument();
  expect(screen.queryByTestId('workspace-kind-form')).not.toBeInTheDocument();
  expect(mockWorkspaceKindForm).not.toHaveBeenCalled();
};

describe('AppRoutes WorkspaceKind admin routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe.each([
    ['create', '/workspacekinds/create'],
    ['edit', '/workspacekinds/jupyterlab/edit'],
  ])('%s route', (_, path) => {
    it('shows the restricted-access message for non-admin users', () => {
      mockUseAppContext.mockReturnValue({
        config: null,
        user: { userId: 'kubeflow-user', clusterAdmin: false },
      });

      renderAt(path);

      expectRestrictedAccess();
    });

    it('shows the restricted-access message when user context is not yet loaded', () => {
      mockUseAppContext.mockReturnValue({ config: null, user: null });

      renderAt(path);

      expectRestrictedAccess();
    });

    it('renders the WorkspaceKind form for clusterAdmin users', () => {
      mockUseAppContext.mockReturnValue({
        config: null,
        user: { userId: 'admin-user', clusterAdmin: true },
      });

      renderAt(path);

      expect(screen.getByTestId('workspace-kind-form')).toBeInTheDocument();
      expect(mockWorkspaceKindForm).toHaveBeenCalled();
      expect(screen.queryByTestId('workspace-kinds-access-empty-state')).not.toBeInTheDocument();
    });
  });
});
