import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WorkspaceDetailsActivity } from '~/app/pages/Workspaces/Details/WorkspaceDetailsActivity';
import {
  V1Beta1WorkspaceState,
  WorkspacesProbeResult,
  WorkspacesWorkspaceListItem,
} from '~/generated/data-contracts';

const baseWorkspace: WorkspacesWorkspaceListItem = {
  name: 'test-ws',
  namespace: 'default',
  paused: false,
  pausedTime: 0,
  pendingRestart: false,
  state: V1Beta1WorkspaceState.WorkspaceStateRunning,
  stateMessage: '',
  workspaceKind: {
    name: 'jupyter',
    missing: false,
    icon: { url: '' },
    logo: { url: '' },
  },
  podTemplate: {
    podMetadata: { labels: {}, annotations: {} },
    volumes: { data: [] },
    options: {
      imageConfig: { current: { id: '', displayName: '', description: '', labels: [] } },
      podConfig: { current: { id: '', displayName: '', description: '', labels: [] } },
    },
  },
  activity: {
    lastActivity: 0,
    lastUpdate: 0,
  },
  services: [],
  audit: { createdAt: '', createdBy: '', updatedAt: '', updatedBy: '', deletedAt: '' },
};

describe('WorkspaceDetailsActivity', () => {
  it('shows unknown when lastActivity is 0', () => {
    render(<WorkspaceDetailsActivity workspace={baseWorkspace} />);
    expect(screen.getByTestId('lastActivity')).toHaveTextContent('unknown');
  });

  it('shows formatted date when lastActivity is set', () => {
    const ws = {
      ...baseWorkspace,
      activity: { ...baseWorkspace.activity, lastActivity: 1_700_000_000_000 },
    };
    render(<WorkspaceDetailsActivity workspace={ws} />);
    expect(screen.getByTestId('lastActivity').textContent).not.toBe('unknown');
  });

  it('shows idle duration and culling countdown when running with culling config', () => {
    const now = Date.now();
    const ws: WorkspacesWorkspaceListItem = {
      ...baseWorkspace,
      state: V1Beta1WorkspaceState.WorkspaceStateRunning,
      workspaceKind: {
        ...baseWorkspace.workspaceKind,
        cullingConfig: { maxInactiveSeconds: 3600 },
      },
      activity: { lastActivity: now - 10 * 60 * 1000, lastUpdate: 0 },
    };
    render(<WorkspaceDetailsActivity workspace={ws} />);
    expect(screen.getByTestId('idleDuration')).toBeInTheDocument();
    expect(screen.getByTestId('cullingCountdown')).toBeInTheDocument();
  });

  it('does not show idle duration when not running', () => {
    const ws: WorkspacesWorkspaceListItem = {
      ...baseWorkspace,
      state: V1Beta1WorkspaceState.WorkspaceStatePaused,
      workspaceKind: {
        ...baseWorkspace.workspaceKind,
        cullingConfig: { maxInactiveSeconds: 3600 },
      },
    };
    render(<WorkspaceDetailsActivity workspace={ws} />);
    expect(screen.queryByTestId('idleDuration')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cullingCountdown')).not.toBeInTheDocument();
  });

  it('does not show idle duration when no culling config', () => {
    const ws = {
      ...baseWorkspace,
      state: V1Beta1WorkspaceState.WorkspaceStateRunning,
    };
    render(<WorkspaceDetailsActivity workspace={ws} />);
    expect(screen.queryByTestId('idleDuration')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cullingCountdown')).not.toBeInTheDocument();
  });

  it('shows probe result when lastProbe is present', () => {
    const ws: WorkspacesWorkspaceListItem = {
      ...baseWorkspace,
      activity: {
        lastActivity: 0,
        lastUpdate: 0,
        lastProbe: {
          startTimeMs: 1_700_000_000_000,
          endTimeMs: 1_700_000_001_000,
          result: WorkspacesProbeResult.ProbeResultSuccess,
          message: '',
        },
      },
    };
    render(<WorkspaceDetailsActivity workspace={ws} />);
    expect(screen.getByTestId('lastProbeResult')).toHaveTextContent('Success');
    expect(screen.getByTestId('lastProbeTime')).toBeInTheDocument();
  });

  it('hides probe section when no lastProbe', () => {
    render(<WorkspaceDetailsActivity workspace={baseWorkspace} />);
    expect(screen.queryByTestId('lastProbeResult')).not.toBeInTheDocument();
  });

  it('shows probe message when non-empty', () => {
    const ws: WorkspacesWorkspaceListItem = {
      ...baseWorkspace,
      activity: {
        lastActivity: 0,
        lastUpdate: 0,
        lastProbe: {
          startTimeMs: 1_700_000_000_000,
          endTimeMs: 1_700_000_001_000,
          result: WorkspacesProbeResult.ProbeResultFailure,
          message: 'connection refused',
        },
      },
    };
    render(<WorkspaceDetailsActivity workspace={ws} />);
    expect(screen.getByTestId('lastProbeResult')).toHaveTextContent('connection refused');
  });

  it('shows pendingRestart as Yes/No', () => {
    const ws = { ...baseWorkspace, pendingRestart: true };
    render(<WorkspaceDetailsActivity workspace={ws} />);
    expect(screen.getByTestId('pendingRestart')).toHaveTextContent('Yes');
  });
});
