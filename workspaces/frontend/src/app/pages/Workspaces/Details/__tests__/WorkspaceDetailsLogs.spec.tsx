import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { FetchState } from 'mod-arch-core';
import { WorkspaceDetailsLogs } from '~/app/pages/Workspaces/Details/WorkspaceDetailsLogs';
import { useWorkspaceLogs } from '~/app/hooks/useWorkspaceLogs';
import { DetailsWorkspaceDetails } from '~/generated/data-contracts';
import { buildMockWorkspace, buildMockWorkspaceDetails } from '~/shared/mock/mockBuilder';

jest.mock('~/app/hooks/useWorkspaceLogs', () => ({
  useWorkspaceLogs: jest.fn(),
}));

// The real LogViewer measures text with a canvas, which jsdom does not implement.
jest.mock('@patternfly/react-log-viewer', () => ({
  LogViewer: ({ data, toolbar }: { data: string; toolbar: React.ReactNode }) => (
    <div>
      {toolbar}
      <pre data-testid="log-viewer-data">{data}</pre>
    </div>
  ),
  LogViewerSearch: () => <input aria-label="Search logs" />,
}));

const mockUseWorkspaceLogs = useWorkspaceLogs as jest.MockedFunction<typeof useWorkspaceLogs>;

const mockWorkspace = buildMockWorkspace({
  name: 'test-workspace',
  namespace: 'test-ns',
  paused: false,
});

const mockLogsState = (state: FetchState<string | null>): void => {
  mockUseWorkspaceLogs.mockReturnValue(state);
};

const renderLogsTab = (
  details: DetailsWorkspaceDetails | null = buildMockWorkspaceDetails(),
  detailsLoaded = true,
  detailsError?: Error,
  workspace = mockWorkspace,
) =>
  render(
    <WorkspaceDetailsLogs
      workspace={workspace}
      details={details}
      detailsLoaded={detailsLoaded}
      detailsError={detailsError}
    />,
  );

describe('WorkspaceDetailsLogs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLogsState(['log line 1\nlog line 2', true, undefined, jest.fn()]);
  });

  it('shows a spinner while the workspace details are loading', () => {
    renderLogsTab(null, false);

    expect(screen.getByTestId('logs-loading-spinner')).toBeInTheDocument();
  });

  it('shows an error state when the workspace details failed to load', () => {
    renderLogsTab(null, true, new Error('boom'));

    expect(screen.getByTestId('logs-error-state')).toBeInTheDocument();
  });

  it('shows an empty state when the workspace has no pod', () => {
    renderLogsTab(buildMockWorkspaceDetails({ pod: undefined }));

    expect(screen.getByTestId('logs-empty-state')).toBeInTheDocument();
    expect(screen.getByText(/no pod yet/i)).toBeInTheDocument();
  });

  it('explains that a paused workspace has no pod to read logs from', () => {
    const pausedWorkspace = buildMockWorkspace({
      name: 'test-workspace',
      namespace: 'test-ns',
      paused: true,
    });
    renderLogsTab(buildMockWorkspaceDetails({ pod: undefined }), true, undefined, pausedWorkspace);

    expect(screen.getByText(/paused/i)).toBeInTheDocument();
  });

  it('shows a spinner while the logs are loading', () => {
    mockLogsState([null, false, undefined, jest.fn()]);
    renderLogsTab();

    expect(screen.getByTestId('logs-loading-spinner')).toBeInTheDocument();
  });

  it('shows an error state when the logs request fails', () => {
    mockLogsState([null, false, new Error('pod is not running'), jest.fn()]);
    renderLogsTab();

    expect(screen.getByTestId('logs-error-state')).toBeInTheDocument();
    expect(screen.getByText('pod is not running')).toBeInTheDocument();
  });

  it('shows an empty state when the container produced no output', () => {
    mockLogsState(['', true, undefined, jest.fn()]);
    renderLogsTab();

    expect(screen.getByTestId('logs-no-output-state')).toBeInTheDocument();
  });

  it('renders the log viewer when logs are available', () => {
    renderLogsTab();

    expect(screen.getByTestId('logs-viewer')).toBeInTheDocument();
    expect(screen.getByTestId('logs-download-button')).toBeEnabled();
  });

  it('requests the logs for the primary container by default', () => {
    renderLogsTab();

    expect(mockUseWorkspaceLogs).toHaveBeenCalledWith(
      'test-ns',
      'test-workspace',
      expect.objectContaining({ container: 'main', tailLines: 1000, previous: false }),
    );
  });

  it('re-requests the logs of the previous container instance when toggled', async () => {
    renderLogsTab();

    await userEvent.click(screen.getByTestId('logs-previous-checkbox'));

    expect(mockUseWorkspaceLogs).toHaveBeenLastCalledWith(
      'test-ns',
      'test-workspace',
      expect.objectContaining({ previous: true }),
    );
  });

  it('refreshes the logs on demand', async () => {
    const refresh = jest.fn();
    mockLogsState(['log line 1', true, undefined, refresh]);
    renderLogsTab();

    await userEvent.click(screen.getByTestId('logs-refresh-button'));

    expect(refresh).toHaveBeenCalled();
  });
});
