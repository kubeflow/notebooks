import { buildMockWorkspace } from '~/shared/mock/mockBuilder';
import { V1Beta1WorkspaceState } from '~/generated/data-contracts';
import {
  ActivityWarningLevel,
  getActivityStatus,
  formatTimeRemaining,
} from '~/shared/utilities/WorkspaceUtils';

const MINUTE = 60 * 1000;

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2025-06-15T12:00:00Z'));
});

afterEach(() => {
  jest.useRealTimers();
});

describe('getActivityStatus', () => {
  describe('warningLevel', () => {
    it('returns Critical when eligibleAfter is 3 minutes from now', () => {
      const workspace = buildMockWorkspace({
        state: V1Beta1WorkspaceState.WorkspaceStateRunning,
        activity: {
          lastActivity: Date.now() - 10 * MINUTE,
          lastUpdate: Date.now() - 10 * MINUTE,
          rules: { pauseWorkspace: { eligibleAfter: Date.now() + 3 * MINUTE } },
        },
      });
      expect(getActivityStatus(workspace).warningLevel).toBe(ActivityWarningLevel.Critical);
    });

    it('returns Warning when eligibleAfter is 10 minutes from now', () => {
      const workspace = buildMockWorkspace({
        state: V1Beta1WorkspaceState.WorkspaceStateRunning,
        activity: {
          lastActivity: Date.now() - 10 * MINUTE,
          lastUpdate: Date.now() - 10 * MINUTE,
          rules: { pauseWorkspace: { eligibleAfter: Date.now() + 10 * MINUTE } },
        },
      });
      expect(getActivityStatus(workspace).warningLevel).toBe(ActivityWarningLevel.Warning);
    });

    it('returns None when eligibleAfter is 20 minutes from now', () => {
      const workspace = buildMockWorkspace({
        state: V1Beta1WorkspaceState.WorkspaceStateRunning,
        activity: {
          lastActivity: Date.now() - 10 * MINUTE,
          lastUpdate: Date.now() - 10 * MINUTE,
          rules: { pauseWorkspace: { eligibleAfter: Date.now() + 20 * MINUTE } },
        },
      });
      expect(getActivityStatus(workspace).warningLevel).toBe(ActivityWarningLevel.None);
    });

    it('returns Critical when eligibleAfter is in the past', () => {
      const workspace = buildMockWorkspace({
        state: V1Beta1WorkspaceState.WorkspaceStateRunning,
        activity: {
          lastActivity: Date.now() - 30 * MINUTE,
          lastUpdate: Date.now() - 30 * MINUTE,
          rules: { pauseWorkspace: { eligibleAfter: Date.now() - 2 * MINUTE } },
        },
      });
      expect(getActivityStatus(workspace).warningLevel).toBe(ActivityWarningLevel.Critical);
    });

    it('returns Critical at exactly 5 minutes boundary', () => {
      const workspace = buildMockWorkspace({
        state: V1Beta1WorkspaceState.WorkspaceStateRunning,
        activity: {
          lastActivity: Date.now() - 10 * MINUTE,
          lastUpdate: Date.now() - 10 * MINUTE,
          rules: { pauseWorkspace: { eligibleAfter: Date.now() + 5 * MINUTE } },
        },
      });
      expect(getActivityStatus(workspace).warningLevel).toBe(ActivityWarningLevel.Critical);
    });

    it('returns Warning at exactly 15 minutes boundary', () => {
      const workspace = buildMockWorkspace({
        state: V1Beta1WorkspaceState.WorkspaceStateRunning,
        activity: {
          lastActivity: Date.now() - 10 * MINUTE,
          lastUpdate: Date.now() - 10 * MINUTE,
          rules: { pauseWorkspace: { eligibleAfter: Date.now() + 15 * MINUTE } },
        },
      });
      expect(getActivityStatus(workspace).warningLevel).toBe(ActivityWarningLevel.Warning);
    });

    it.each([
      V1Beta1WorkspaceState.WorkspaceStatePaused,
      V1Beta1WorkspaceState.WorkspaceStatePending,
      V1Beta1WorkspaceState.WorkspaceStateTerminating,
      V1Beta1WorkspaceState.WorkspaceStateError,
      V1Beta1WorkspaceState.WorkspaceStateUnknown,
    ])('returns None for non-running state: %s', (state) => {
      const workspace = buildMockWorkspace({
        state,
        activity: {
          lastActivity: Date.now() - 10 * MINUTE,
          lastUpdate: Date.now() - 10 * MINUTE,
          rules: { pauseWorkspace: { eligibleAfter: Date.now() + 3 * MINUTE } },
        },
      });
      expect(getActivityStatus(workspace).warningLevel).toBe(ActivityWarningLevel.None);
    });

    it('returns None when no activity rules exist', () => {
      const workspace = buildMockWorkspace({
        state: V1Beta1WorkspaceState.WorkspaceStateRunning,
        activity: {
          lastActivity: Date.now() - 10 * MINUTE,
          lastUpdate: Date.now() - 10 * MINUTE,
        },
      });
      expect(getActivityStatus(workspace).warningLevel).toBe(ActivityWarningLevel.None);
    });

    it('returns None when pauseWorkspace rule is undefined', () => {
      const workspace = buildMockWorkspace({
        state: V1Beta1WorkspaceState.WorkspaceStateRunning,
        activity: {
          lastActivity: Date.now() - 10 * MINUTE,
          lastUpdate: Date.now() - 10 * MINUTE,
          rules: {},
        },
      });
      expect(getActivityStatus(workspace).warningLevel).toBe(ActivityWarningLevel.None);
    });
  });

  describe('timeRemainingMs', () => {
    it('returns milliseconds until auto-pause for a running workspace', () => {
      const workspace = buildMockWorkspace({
        state: V1Beta1WorkspaceState.WorkspaceStateRunning,
        activity: {
          lastActivity: Date.now() - 10 * MINUTE,
          lastUpdate: Date.now() - 10 * MINUTE,
          rules: { pauseWorkspace: { eligibleAfter: Date.now() + 10 * MINUTE } },
        },
      });
      expect(getActivityStatus(workspace).timeRemainingMs).toBe(10 * MINUTE);
    });

    it('returns null for non-running workspace', () => {
      const workspace = buildMockWorkspace({
        state: V1Beta1WorkspaceState.WorkspaceStatePaused,
        activity: {
          lastActivity: Date.now() - 10 * MINUTE,
          lastUpdate: Date.now() - 10 * MINUTE,
          rules: { pauseWorkspace: { eligibleAfter: Date.now() + 10 * MINUTE } },
        },
      });
      expect(getActivityStatus(workspace).timeRemainingMs).toBeNull();
    });

    it('returns null when no pauseWorkspace rule exists', () => {
      const workspace = buildMockWorkspace({
        state: V1Beta1WorkspaceState.WorkspaceStateRunning,
        activity: {
          lastActivity: Date.now() - 10 * MINUTE,
          lastUpdate: Date.now() - 10 * MINUTE,
        },
      });
      expect(getActivityStatus(workspace).timeRemainingMs).toBeNull();
    });

    it('returns negative value when eligibleAfter is in the past', () => {
      const workspace = buildMockWorkspace({
        state: V1Beta1WorkspaceState.WorkspaceStateRunning,
        activity: {
          lastActivity: Date.now() - 30 * MINUTE,
          lastUpdate: Date.now() - 30 * MINUTE,
          rules: { pauseWorkspace: { eligibleAfter: Date.now() - 5 * MINUTE } },
        },
      });
      expect(getActivityStatus(workspace).timeRemainingMs).toBe(-5 * MINUTE);
    });
  });

  describe('actionMessage', () => {
    it('returns "paused" when pauseWorkspace rule exists', () => {
      const workspace = buildMockWorkspace({
        activity: {
          lastActivity: Date.now() - 10 * MINUTE,
          lastUpdate: Date.now() - 10 * MINUTE,
          rules: { pauseWorkspace: { eligibleAfter: Date.now() + 10 * MINUTE } },
        },
      });
      expect(getActivityStatus(workspace).actionMessage).toBe('paused');
    });

    it('returns null when no activity rules exist', () => {
      const workspace = buildMockWorkspace({
        activity: {
          lastActivity: Date.now() - 10 * MINUTE,
          lastUpdate: Date.now() - 10 * MINUTE,
        },
      });
      expect(getActivityStatus(workspace).actionMessage).toBeNull();
    });

    it('returns null when rules object is empty', () => {
      const workspace = buildMockWorkspace({
        activity: {
          lastActivity: Date.now() - 10 * MINUTE,
          lastUpdate: Date.now() - 10 * MINUTE,
          rules: {},
        },
      });
      expect(getActivityStatus(workspace).actionMessage).toBeNull();
    });
  });
});

describe('formatTimeRemaining', () => {
  it('returns a human-readable string for positive time', () => {
    const result = formatTimeRemaining(10 * MINUTE);
    expect(result).toMatch(/minute/);
  });

  it('returns "less than a minute" for zero or negative time', () => {
    expect(formatTimeRemaining(0)).toBe('less than a minute');
    expect(formatTimeRemaining(-5 * MINUTE)).toBe('less than a minute');
  });
});
