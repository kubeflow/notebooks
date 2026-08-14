import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { WorkspaceDetailsLogs } from '~/app/pages/Workspaces/Details/WorkspaceDetailsLogs';
import { useWorkspaceLogsController, WorkspaceLogsController } from '~/app/hooks/useWorkspaceLogs';
import { DetailsWorkspaceDetails } from '~/generated/data-contracts';
import { buildMockWorkspace, buildMockWorkspaceDetails } from '~/shared/mock/mockBuilder';

// Keep the real constants (used by the toolbar); only stub the controller hook, whose
// internal fetch cannot be intercepted by mocking the exported `useWorkspaceLogs`.
jest.mock('~/app/hooks/useWorkspaceLogs', () => ({
  ...jest.requireActual('~/app/hooks/useWorkspaceLogs'),
  useWorkspaceLogsController: jest.fn(),
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

const mockUseWorkspaceLogsController = useWorkspaceLogsController as jest.MockedFunction<
  typeof useWorkspaceLogsController
>;

const mockWorkspace = buildMockWorkspace({
  name: 'test-workspace',
  namespace: 'test-ns',
  paused: false,
});

const buildController = (
  overrides: Partial<WorkspaceLogsController> = {},
): WorkspaceLogsController => ({
  hasPod: true,
  container: 'main',
  containerOptions: [
    { key: 'container/main', name: 'main', isInit: false },
    { key: 'init/istio-proxy', name: 'istio-proxy', isInit: true },
  ],
  activeContainerKey: 'container/main',
  selectContainer: jest.fn(),
  tailLines: 1000,
  setTailLines: jest.fn(),
  sinceLabel: 'All time',
  setSinceLabel: jest.fn(),
  previous: false,
  setPrevious: jest.fn(),
  isTextWrapped: false,
  setIsTextWrapped: jest.fn(),
  scrollToRow: undefined,
  setScrollToRow: jest.fn(),
  logs: 'log line 1\nlog line 2',
  logsLoaded: true,
  logsError: undefined,
  refreshLogs: jest.fn(),
  ...overrides,
});

const mockController = (overrides: Partial<WorkspaceLogsController> = {}): void => {
  mockUseWorkspaceLogsController.mockReturnValue(buildController(overrides));
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
    mockController();
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
    mockController({ hasPod: false });
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
    mockController({ hasPod: false });
    renderLogsTab(buildMockWorkspaceDetails({ pod: undefined }), true, undefined, pausedWorkspace);

    expect(screen.getByText(/paused/i)).toBeInTheDocument();
  });

  it('shows a spinner while the logs are loading', () => {
    mockController({ logs: null, logsLoaded: false });
    renderLogsTab();

    expect(screen.getByTestId('logs-loading-spinner')).toBeInTheDocument();
  });

  it('shows an error state when the logs request fails', () => {
    mockController({ logs: null, logsLoaded: false, logsError: new Error('pod is not running') });
    renderLogsTab();

    expect(screen.getByTestId('logs-error-state')).toBeInTheDocument();
    expect(screen.getByText('pod is not running')).toBeInTheDocument();
  });

  it('shows an empty state when the container produced no output', () => {
    mockController({ logs: '', logsLoaded: true });
    renderLogsTab();

    expect(screen.getByTestId('logs-no-output-state')).toBeInTheDocument();
  });

  it('renders the log viewer when logs are available', () => {
    renderLogsTab();

    expect(screen.getByTestId('logs-viewer')).toBeInTheDocument();
    expect(screen.getByTestId('logs-download-button')).toBeEnabled();
  });

  it('toggles the previous container option', async () => {
    const setPrevious = jest.fn();
    mockController({ setPrevious });
    renderLogsTab();

    await userEvent.click(screen.getByTestId('logs-previous-checkbox'));

    expect(setPrevious).toHaveBeenCalledWith(true);
  });

  it('refreshes the logs on demand', async () => {
    const refreshLogs = jest.fn();
    mockController({ refreshLogs });
    renderLogsTab();

    await userEvent.click(screen.getByTestId('logs-refresh-button'));

    expect(refreshLogs).toHaveBeenCalled();
  });
});
