import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import WorkspaceTable from '~/app/components/WorkspaceTable';
import { V1Beta1WorkspaceState } from '~/generated/data-contracts';
import { buildMockWorkspace } from '~/shared/mock/mockBuilder';

jest.mock('~/app/hooks/useWorkspaceKinds', () => ({
  __esModule: true,
  default: () => [[]],
}));

jest.mock('~/app/routerHelper', () => ({
  useTypedNavigate: () => ({ navigate: jest.fn() }),
}));

jest.mock('~/app/components/WorkspaceKindImage', () => ({
  __esModule: true,
  default: ({ children }: { children: (src: string) => React.ReactNode }) => <>{children('')}</>,
}));

jest.mock('~/app/components/RedirectIconWithPopover', () => ({
  RedirectIconWithPopover: () => null,
}));

jest.mock('~/app/pages/Workspaces/WorkspaceConnectAction', () => ({
  WorkspaceConnectAction: () => null,
}));

describe('WorkspaceTable state column', () => {
  it('renders "Unknown" when workspace.state is empty', () => {
    const workspace = buildMockWorkspace({
      state: '' as V1Beta1WorkspaceState,
      stateMessage: '',
    });

    render(
      <WorkspaceTable
        workspaces={[workspace]}
        refreshWorkspaces={jest.fn()}
        rowActions={() => []}
      />,
    );

    const stateCell = screen.getByTestId('state-label');
    expect(stateCell).toHaveTextContent('Unknown');
  });

  it('shows the real state in the tooltip when stateMessage is empty but state is set', () => {
    const workspace = buildMockWorkspace({
      state: V1Beta1WorkspaceState.WorkspaceStateRunning,
      stateMessage: '',
    });

    render(
      <WorkspaceTable
        workspaces={[workspace]}
        refreshWorkspaces={jest.fn()}
        rowActions={() => []}
      />,
    );

    const stateCell = screen.getByTestId('state-label');
    expect(stateCell).toHaveTextContent('Running');
  });
});

describe('WorkspaceTable name column', () => {
  it('renders the name as plain text when no viewDetails row action is provided', () => {
    const workspace = buildMockWorkspace({});

    render(
      <WorkspaceTable
        workspaces={[workspace]}
        refreshWorkspaces={jest.fn()}
        rowActions={() => []}
      />,
    );

    expect(screen.queryByTestId('workspace-name-link')).not.toBeInTheDocument();
    expect(screen.getByTestId('workspace-name')).toHaveTextContent(workspace.name);
  });

  it('renders the name as a clickable link that triggers the viewDetails action', async () => {
    const user = userEvent.setup();
    const workspace = buildMockWorkspace({});
    const onViewDetailsClick = jest.fn();

    render(
      <WorkspaceTable
        workspaces={[workspace]}
        refreshWorkspaces={jest.fn()}
        rowActions={() => [
          { id: 'viewDetails', title: 'View Details', onClick: onViewDetailsClick },
        ]}
      />,
    );

    const nameLink = screen.getByTestId('workspace-name-link');
    expect(nameLink).toHaveTextContent(workspace.name);

    await user.click(nameLink);

    expect(onViewDetailsClick).toHaveBeenCalledTimes(1);
  });
});
