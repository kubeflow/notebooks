import { renderHook } from '~/__tests__/unit/testUtils/hooks';
import useActivityNotifications from '~/app/hooks/useActivityNotifications';
import { V1Beta1WorkspaceState, WorkspacesWorkspaceListItem } from '~/generated/data-contracts';
import { buildMockWorkspace } from '~/shared/mock/mockBuilder';

const MINUTE = 60 * 1000;

const mockWarning = jest.fn();

jest.mock('mod-arch-core', () => ({
  ...jest.requireActual('mod-arch-core'),
  useNotification: () => ({
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: mockWarning,
    remove: jest.fn(),
  }),
}));

const buildRunningWorkspace = (
  name: string,
  eligibleAfterMs: number,
): WorkspacesWorkspaceListItem =>
  buildMockWorkspace({
    name,
    namespace: 'default',
    state: V1Beta1WorkspaceState.WorkspaceStateRunning,
    activity: {
      lastActivity: Date.now() - 10 * MINUTE,
      lastUpdate: Date.now() - 10 * MINUTE,
      rules: { pauseWorkspace: { eligibleAfter: Date.now() + eligibleAfterMs } },
    },
  });

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2025-06-15T12:00:00Z'));
  mockWarning.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useActivityNotifications', () => {
  it('does not fire toast on initial render even if workspaces are in warning state', () => {
    const workspaces = [buildRunningWorkspace('ws-1', 10 * MINUTE)];

    renderHook(() => useActivityNotifications(workspaces));

    expect(mockWarning).not.toHaveBeenCalled();
  });

  it('fires toast on None → Warning transition', () => {
    const safeWorkspace = [buildRunningWorkspace('ws-1', 20 * MINUTE)];
    const { rerender } = renderHook(
      ({ ws }: { ws: WorkspacesWorkspaceListItem[] }) => useActivityNotifications(ws),
      { initialProps: { ws: safeWorkspace } },
    );

    expect(mockWarning).not.toHaveBeenCalled();

    const warningWorkspace = [buildRunningWorkspace('ws-1', 10 * MINUTE)];
    rerender({ ws: warningWorkspace });

    expect(mockWarning).toHaveBeenCalledTimes(1);
    expect(mockWarning).toHaveBeenCalledWith(expect.stringContaining('ws-1'));
  });

  it('fires toast on None → Critical transition', () => {
    const safeWorkspace = [buildRunningWorkspace('ws-1', 20 * MINUTE)];
    const { rerender } = renderHook(
      ({ ws }: { ws: WorkspacesWorkspaceListItem[] }) => useActivityNotifications(ws),
      { initialProps: { ws: safeWorkspace } },
    );

    const criticalWorkspace = [buildRunningWorkspace('ws-1', 3 * MINUTE)];
    rerender({ ws: criticalWorkspace });

    expect(mockWarning).toHaveBeenCalledTimes(1);
    expect(mockWarning).toHaveBeenCalledWith(expect.stringContaining('ws-1'));
  });

  it('fires toast on Warning → Critical escalation', () => {
    const safeWorkspace = [buildRunningWorkspace('ws-1', 20 * MINUTE)];
    const { rerender } = renderHook(
      ({ ws }: { ws: WorkspacesWorkspaceListItem[] }) => useActivityNotifications(ws),
      { initialProps: { ws: safeWorkspace } },
    );

    const warningWorkspace = [buildRunningWorkspace('ws-1', 10 * MINUTE)];
    rerender({ ws: warningWorkspace });
    expect(mockWarning).toHaveBeenCalledTimes(1);

    const criticalWorkspace = [buildRunningWorkspace('ws-1', 3 * MINUTE)];
    rerender({ ws: criticalWorkspace });
    expect(mockWarning).toHaveBeenCalledTimes(2);
  });

  it('does not fire toast on Warning → None (auto-clear)', () => {
    const safeWorkspace = [buildRunningWorkspace('ws-1', 20 * MINUTE)];
    const { rerender } = renderHook(
      ({ ws }: { ws: WorkspacesWorkspaceListItem[] }) => useActivityNotifications(ws),
      { initialProps: { ws: safeWorkspace } },
    );

    const warningWorkspace = [buildRunningWorkspace('ws-1', 10 * MINUTE)];
    rerender({ ws: warningWorkspace });
    expect(mockWarning).toHaveBeenCalledTimes(1);
    mockWarning.mockClear();

    const clearedWorkspace = [buildRunningWorkspace('ws-1', 25 * MINUTE)];
    rerender({ ws: clearedWorkspace });
    expect(mockWarning).not.toHaveBeenCalled();
  });

  it('does not re-fire toast on stable Warning → Warning', () => {
    const safeWorkspace = [buildRunningWorkspace('ws-1', 20 * MINUTE)];
    const { rerender } = renderHook(
      ({ ws }: { ws: WorkspacesWorkspaceListItem[] }) => useActivityNotifications(ws),
      { initialProps: { ws: safeWorkspace } },
    );

    const warningWorkspace1 = [buildRunningWorkspace('ws-1', 10 * MINUTE)];
    rerender({ ws: warningWorkspace1 });
    expect(mockWarning).toHaveBeenCalledTimes(1);

    const warningWorkspace2 = [buildRunningWorkspace('ws-1', 8 * MINUTE)];
    rerender({ ws: warningWorkspace2 });
    expect(mockWarning).toHaveBeenCalledTimes(1);
  });

  it('only fires toast for transitioning workspaces, not stable ones', () => {
    const initial = [
      buildRunningWorkspace('ws-stable', 20 * MINUTE),
      buildRunningWorkspace('ws-transition', 20 * MINUTE),
    ];
    const { rerender } = renderHook(
      ({ ws }: { ws: WorkspacesWorkspaceListItem[] }) => useActivityNotifications(ws),
      { initialProps: { ws: initial } },
    );

    const updated = [
      buildRunningWorkspace('ws-stable', 20 * MINUTE),
      buildRunningWorkspace('ws-transition', 10 * MINUTE),
    ];
    rerender({ ws: updated });

    expect(mockWarning).toHaveBeenCalledTimes(1);
    expect(mockWarning).toHaveBeenCalledWith(expect.stringContaining('ws-transition'));
  });

  it('cleans up tracking for removed workspaces', () => {
    const initial = [buildRunningWorkspace('ws-1', 20 * MINUTE)];
    const { rerender } = renderHook(
      ({ ws }: { ws: WorkspacesWorkspaceListItem[] }) => useActivityNotifications(ws),
      { initialProps: { ws: initial } },
    );

    const warningState = [buildRunningWorkspace('ws-1', 10 * MINUTE)];
    rerender({ ws: warningState });
    expect(mockWarning).toHaveBeenCalledTimes(1);
    mockWarning.mockClear();

    rerender({ ws: [] });

    const reappeared = [buildRunningWorkspace('ws-1', 10 * MINUTE)];
    rerender({ ws: reappeared });
    expect(mockWarning).toHaveBeenCalledTimes(1);
  });
});
