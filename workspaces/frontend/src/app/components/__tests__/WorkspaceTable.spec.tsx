import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
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

describe('WorkspaceTable row order stability during background refresh', () => {
  const getVisibleWorkspaceNames = () =>
    screen.getAllByTestId('workspace-name').map((el) => el.textContent);

  const buildWorkspacesAB = () => [
    buildMockWorkspace({
      name: 'workspace-a',
      activity: { lastActivity: new Date(2025, 5, 2).getTime(), lastUpdate: 0 },
    }),
    buildMockWorkspace({
      name: 'workspace-b',
      activity: { lastActivity: new Date(2025, 5, 1).getTime(), lastUpdate: 0 },
    }),
  ];

  it('never reorders rows from a background refresh alone, with no user interaction at all', () => {
    const [workspaceA, workspaceB] = buildWorkspacesAB();

    // Default sort is "Last activity" descending, so workspace-a (more recent) renders first.
    const { rerender } = render(
      <WorkspaceTable
        workspaces={[workspaceA, workspaceB]}
        refreshWorkspaces={jest.fn()}
        rowActions={() => []}
      />,
    );
    expect(getVisibleWorkspaceNames()).toEqual(['workspace-a', 'workspace-b']);

    // A background poll arrives with activity swapped — would flip the order if auto-resorted.
    const refreshedWorkspaceA = {
      ...workspaceA,
      activity: { lastActivity: new Date(2025, 4, 1).getTime(), lastUpdate: 0 },
    };
    const refreshedWorkspaceB = {
      ...workspaceB,
      activity: { lastActivity: new Date(2025, 5, 3).getTime(), lastUpdate: 0 },
    };

    rerender(
      <WorkspaceTable
        workspaces={[refreshedWorkspaceA, refreshedWorkspaceB]}
        refreshWorkspaces={jest.fn()}
        rowActions={() => []}
      />,
    );

    expect(getVisibleWorkspaceNames()).toEqual(['workspace-a', 'workspace-b']);
  });

  it('re-sorts immediately when the user clicks a different sort column', async () => {
    const user = userEvent.setup();
    // Alphabetically, 'workspace-a' < 'workspace-b', opposite of the default last-activity order.
    const [workspaceA, workspaceB] = buildWorkspacesAB();

    render(
      <WorkspaceTable
        workspaces={[workspaceA, workspaceB]}
        refreshWorkspaces={jest.fn()}
        rowActions={() => []}
      />,
    );
    expect(getVisibleWorkspaceNames()).toEqual(['workspace-a', 'workspace-b']);

    // Click the "Name" column header twice: once to sort ascending, once more for descending —
    // proves an explicit sort change always takes effect immediately, regardless of the
    // background-refresh freeze. Scoped to the table to avoid the toolbar's "Name" filter toggle.
    const table = within(screen.getByTestId('workspaces-table'));
    await user.click(table.getByRole('button', { name: /^name$/i }));
    await user.click(table.getByRole('button', { name: /^name$/i }));

    expect(getVisibleWorkspaceNames()).toEqual(['workspace-b', 'workspace-a']);
  });

  it('defers resorting a manual refresh click until the resulting data actually arrives', () => {
    const [workspaceA, workspaceB] = buildWorkspacesAB();

    const { rerender } = render(
      <WorkspaceTable
        workspaces={[workspaceA, workspaceB]}
        refreshWorkspaces={jest.fn()}
        rowActions={() => []}
      />,
    );
    expect(getVisibleWorkspaceNames()).toEqual(['workspace-a', 'workspace-b']);

    fireEvent.click(screen.getByTestId('workspace-refresh-now'));
    // No new data yet (fetch still "in flight") — order must not change on the click itself.
    expect(getVisibleWorkspaceNames()).toEqual(['workspace-a', 'workspace-b']);

    // The refetch triggered by that click lands, with activity swapped — now it resorts.
    const refreshedWorkspaceA = {
      ...workspaceA,
      activity: { lastActivity: new Date(2025, 4, 1).getTime(), lastUpdate: 0 },
    };
    const refreshedWorkspaceB = {
      ...workspaceB,
      activity: { lastActivity: new Date(2025, 5, 3).getTime(), lastUpdate: 0 },
    };

    rerender(
      <WorkspaceTable
        workspaces={[refreshedWorkspaceA, refreshedWorkspaceB]}
        refreshWorkspaces={jest.fn()}
        rowActions={() => []}
      />,
    );

    expect(getVisibleWorkspaceNames()).toEqual(['workspace-b', 'workspace-a']);
  });

  it('removes a deleted row immediately even while order is otherwise frozen', () => {
    const workspaceA = buildMockWorkspace({
      name: 'workspace-a',
      activity: { lastActivity: new Date(2025, 5, 3).getTime(), lastUpdate: 0 },
    });
    const workspaceB = buildMockWorkspace({
      name: 'workspace-b',
      activity: { lastActivity: new Date(2025, 5, 2).getTime(), lastUpdate: 0 },
    });
    const workspaceC = buildMockWorkspace({
      name: 'workspace-c',
      activity: { lastActivity: new Date(2025, 5, 1).getTime(), lastUpdate: 0 },
    });

    const { rerender } = render(
      <WorkspaceTable
        workspaces={[workspaceA, workspaceB, workspaceC]}
        refreshWorkspaces={jest.fn()}
        rowActions={() => []}
      />,
    );
    expect(getVisibleWorkspaceNames()).toEqual(['workspace-a', 'workspace-b', 'workspace-c']);

    // workspace-a is deleted via a plain background poll (no explicit user action).
    rerender(
      <WorkspaceTable
        workspaces={[workspaceB, workspaceC]}
        refreshWorkspaces={jest.fn()}
        rowActions={() => []}
      />,
    );

    expect(getVisibleWorkspaceNames()).toEqual(['workspace-b', 'workspace-c']);
  });

  it('appends a newly-added row to the end instead of its sorted position', () => {
    const [workspaceA, workspaceB] = buildWorkspacesAB();

    const { rerender } = render(
      <WorkspaceTable
        workspaces={[workspaceA, workspaceB]}
        refreshWorkspaces={jest.fn()}
        rowActions={() => []}
      />,
    );
    expect(getVisibleWorkspaceNames()).toEqual(['workspace-a', 'workspace-b']);

    // workspace-c arrives via a plain background poll, with activity that would sort it between
    // a and b if the table fully re-sorted — but a background poll alone must not do that.
    const workspaceC = buildMockWorkspace({
      name: 'workspace-c',
      activity: { lastActivity: new Date(2025, 5, 1, 12).getTime(), lastUpdate: 0 },
    });

    rerender(
      <WorkspaceTable
        workspaces={[workspaceA, workspaceB, workspaceC]}
        refreshWorkspaces={jest.fn()}
        rowActions={() => []}
      />,
    );

    expect(getVisibleWorkspaceNames()).toEqual(['workspace-a', 'workspace-b', 'workspace-c']);
  });

  it('re-sorts immediately when the user changes a filter', async () => {
    const user = userEvent.setup();
    const workspaceA = buildMockWorkspace({
      name: 'workspace-a',
      activity: { lastActivity: new Date(2025, 5, 3).getTime(), lastUpdate: 0 },
    });
    const workspaceB = buildMockWorkspace({
      name: 'workspace-b',
      activity: { lastActivity: new Date(2025, 5, 2).getTime(), lastUpdate: 0 },
    });
    const workspaceC = buildMockWorkspace({
      name: 'workspace-c',
      activity: { lastActivity: new Date(2025, 5, 1).getTime(), lastUpdate: 0 },
    });

    const { rerender } = render(
      <WorkspaceTable
        workspaces={[workspaceA, workspaceB, workspaceC]}
        refreshWorkspaces={jest.fn()}
        rowActions={() => []}
      />,
    );
    expect(getVisibleWorkspaceNames()).toEqual(['workspace-a', 'workspace-b', 'workspace-c']);

    // A background poll reverses the true activity order — frozen order must not react to it.
    const refreshedA = {
      ...workspaceA,
      activity: { lastActivity: new Date(2025, 4, 1).getTime(), lastUpdate: 0 },
    };
    const refreshedB = { ...workspaceB };
    const refreshedC = {
      ...workspaceC,
      activity: { lastActivity: new Date(2025, 5, 4).getTime(), lastUpdate: 0 },
    };

    rerender(
      <WorkspaceTable
        workspaces={[refreshedA, refreshedB, refreshedC]}
        refreshWorkspaces={jest.fn()}
        rowActions={() => []}
      />,
    );
    expect(getVisibleWorkspaceNames()).toEqual(['workspace-a', 'workspace-b', 'workspace-c']);

    // Filtering by a substring common to all three doesn't remove any row, but is still an
    // explicit user action — it must force an immediate catch-up sort using the latest data.
    await user.type(screen.getByPlaceholderText('Filter by name'), 'workspace');

    expect(getVisibleWorkspaceNames()).toEqual(['workspace-c', 'workspace-b', 'workspace-a']);
  });

  it('re-sorts immediately when the user changes page', async () => {
    const user = userEvent.setup();
    // 11 workspaces so there are two pages at the default 10-per-page: index 0 is most recent
    // (sorts first by default), index 10 is oldest.
    const workspaces = Array.from({ length: 11 }, (_, index) =>
      buildMockWorkspace({
        name: `workspace-${index}`,
        activity: {
          lastActivity: new Date(2025, 5, 1).getTime() - index * 60_000,
          lastUpdate: 0,
        },
      }),
    );

    const { rerender } = render(
      <WorkspaceTable
        workspaces={workspaces}
        refreshWorkspaces={jest.fn()}
        rowActions={() => []}
      />,
    );
    expect(getVisibleWorkspaceNames()).toEqual(workspaces.slice(0, 10).map((ws) => ws.name));

    // A background poll completely reverses activity order — frozen order must not react to it.
    const reversedWorkspaces = workspaces.map((ws, index) => ({
      ...ws,
      activity: {
        lastActivity: new Date(2025, 5, 1).getTime() - (10 - index) * 60_000,
        lastUpdate: 0,
      },
    }));

    rerender(
      <WorkspaceTable
        workspaces={reversedWorkspaces}
        refreshWorkspaces={jest.fn()}
        rowActions={() => []}
      />,
    );
    expect(getVisibleWorkspaceNames()).toEqual(workspaces.slice(0, 10).map((ws) => ws.name));

    // Changing page is an explicit action — it must force a catch-up sort using the latest data.
    // Under the reversed activity, workspace-0 is now the oldest, so it's the sole row on page 2.
    await user.click(screen.getByRole('button', { name: 'Go to next page' }));

    expect(getVisibleWorkspaceNames()).toEqual(['workspace-0']);
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
