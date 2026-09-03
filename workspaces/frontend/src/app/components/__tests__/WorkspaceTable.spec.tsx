import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import WorkspaceTable from '~/app/components/WorkspaceTable';
import { V1Beta1WorkspaceState } from '~/generated/data-contracts';
import {
  buildMockWorkspace,
  buildMockWorkspaceWithActivityWarning,
  buildMockWorkspaceWithActivityCritical,
  buildMockWorkspaceNoActivityRules,
} from '~/shared/mock/mockBuilder';

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

describe('WorkspaceTable activity indicators', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-06-15T12:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows outlined warning label for workspace ~10 min from activity', () => {
    const workspace = buildMockWorkspaceWithActivityWarning();

    render(
      <WorkspaceTable
        workspaces={[workspace]}
        refreshWorkspaces={jest.fn()}
        rowActions={() => []}
      />,
    );

    expect(screen.getByTestId('activity-warning-indicator')).toBeInTheDocument();
  });

  it('shows outlined danger label for workspace ~3 min from activity', () => {
    const workspace = buildMockWorkspaceWithActivityCritical();

    render(
      <WorkspaceTable
        workspaces={[workspace]}
        refreshWorkspaces={jest.fn()}
        rowActions={() => []}
      />,
    );

    expect(screen.getByTestId('activity-critical-indicator')).toBeInTheDocument();
  });

  it('does not show activity indicator for workspace 20 min from activity', () => {
    const workspace = buildMockWorkspace({
      state: V1Beta1WorkspaceState.WorkspaceStateRunning,
      activity: {
        lastActivity: Date.now() - 5 * 60 * 1000,
        lastUpdate: Date.now() - 5 * 60 * 1000,
        rules: { pauseWorkspace: { eligibleAfter: Date.now() + 20 * 60 * 1000 } },
      },
    });

    render(
      <WorkspaceTable
        workspaces={[workspace]}
        refreshWorkspaces={jest.fn()}
        rowActions={() => []}
      />,
    );

    expect(screen.queryByTestId('activity-warning-indicator')).not.toBeInTheDocument();
    expect(screen.queryByTestId('activity-critical-indicator')).not.toBeInTheDocument();
  });

  it('does not show activity indicator for paused workspace', () => {
    const workspace = buildMockWorkspace({
      state: V1Beta1WorkspaceState.WorkspaceStatePaused,
      activity: {
        lastActivity: Date.now() - 20 * 60 * 1000,
        lastUpdate: Date.now() - 20 * 60 * 1000,
        rules: { pauseWorkspace: { eligibleAfter: Date.now() + 3 * 60 * 1000 } },
      },
    });

    render(
      <WorkspaceTable
        workspaces={[workspace]}
        refreshWorkspaces={jest.fn()}
        rowActions={() => []}
      />,
    );

    expect(screen.queryByTestId('activity-warning-indicator')).not.toBeInTheDocument();
    expect(screen.queryByTestId('activity-critical-indicator')).not.toBeInTheDocument();
  });

  it('does not show activity indicator for workspace without activity rules', () => {
    const workspace = buildMockWorkspaceNoActivityRules();

    render(
      <WorkspaceTable
        workspaces={[workspace]}
        refreshWorkspaces={jest.fn()}
        rowActions={() => []}
      />,
    );

    expect(screen.queryByTestId('activity-warning-indicator')).not.toBeInTheDocument();
    expect(screen.queryByTestId('activity-critical-indicator')).not.toBeInTheDocument();
  });
});
