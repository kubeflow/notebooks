import React, { useCallback } from 'react';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { EmptyState, EmptyStateBody } from '@patternfly/react-core/dist/esm/components/EmptyState';
import { Spinner } from '@patternfly/react-core/dist/esm/components/Spinner';
import { AngleDoubleDownIcon } from '@patternfly/react-icons/dist/esm/icons/angle-double-down-icon';
import { CubesIcon } from '@patternfly/react-icons/dist/esm/icons/cubes-icon';
import { ExclamationCircleIcon } from '@patternfly/react-icons/dist/esm/icons/exclamation-circle-icon';
import { LogViewer } from '@patternfly/react-log-viewer';
import { useWorkspaceLogsController } from '~/app/hooks/useWorkspaceLogs';
import { DetailsWorkspaceDetails, WorkspacesWorkspaceListItem } from '~/generated/data-contracts';
import { extractErrorMessage } from '~/shared/api/apiUtils';
import { WorkspaceLogsToolbar } from '~/app/pages/Workspaces/Details/WorkspaceLogsToolbar';

const LogsErrorState: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <EmptyState
    headingLevel="h4"
    titleText="Unable to load logs"
    icon={ExclamationCircleIcon}
    status="danger"
    data-testid="logs-error-state"
  >
    <EmptyStateBody>{children}</EmptyStateBody>
  </EmptyState>
);

interface WorkspaceDetailsLogsProps {
  workspace: WorkspacesWorkspaceListItem;
  details: DetailsWorkspaceDetails | null;
  detailsLoaded: boolean;
  detailsError?: Error;
}

export const WorkspaceDetailsLogs: React.FC<WorkspaceDetailsLogsProps> = ({
  workspace,
  details,
  detailsLoaded,
  detailsError,
}) => {
  const controller = useWorkspaceLogsController(workspace, details);
  const {
    hasPod,
    container,
    logs,
    logsLoaded,
    logsError,
    isTextWrapped,
    scrollToRow,
    setScrollToRow,
  } = controller;

  const onDownload = useCallback(() => {
    const blob = new Blob([logs ?? ''], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${workspace.name}-${container ?? 'logs'}.log`;
    // The anchor must be in the DOM for the click to trigger a download in Firefox, and
    // the object URL must outlive the click, so revoke it on the next tick.
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }, [logs, workspace.name, container]);

  const onScrollToBottom = useCallback(() => {
    setScrollToRow((logs ?? '').split('\n').length);
  }, [logs, setScrollToRow]);

  if (detailsError) {
    return <LogsErrorState>Failed to load details</LogsErrorState>;
  }

  if (!detailsLoaded) {
    return <Spinner size="md" data-testid="logs-loading-spinner" />;
  }

  if (!hasPod) {
    return (
      <EmptyState
        headingLevel="h4"
        titleText="No logs available"
        icon={CubesIcon}
        data-testid="logs-empty-state"
      >
        <EmptyStateBody>
          {workspace.paused
            ? 'This workspace is paused, so it has no running pod to read logs from.'
            : 'This workspace has no pod yet. Logs become available once a pod has been created.'}
        </EmptyStateBody>
      </EmptyState>
    );
  }

  let logViewerBody: React.ReactNode = null;
  if (logsError) {
    const message = extractErrorMessage(logsError);
    logViewerBody = (
      <LogsErrorState>
        {typeof message === 'string' ? message : message.error.message}
      </LogsErrorState>
    );
  } else if (!logsLoaded) {
    logViewerBody = <Spinner size="md" data-testid="logs-loading-spinner" />;
  } else if (!logs) {
    logViewerBody = (
      <EmptyState
        headingLevel="h4"
        titleText="No log output"
        icon={CubesIcon}
        data-testid="logs-no-output-state"
      >
        <EmptyStateBody>
          {controller.previous
            ? 'The previous container instance did not produce any log output.'
            : 'This container has not produced any log output yet.'}
        </EmptyStateBody>
      </EmptyState>
    );
  }

  return (
    <div style={{ height: '100%' }} data-testid="logs-viewer">
      {logViewerBody ? (
        <>
          <WorkspaceLogsToolbar
            controller={controller}
            withSearch={false}
            onDownload={onDownload}
          />
          {logViewerBody}
        </>
      ) : (
        <LogViewer
          data={logs ?? ''}
          // The line number gutter is not worth its width in the narrow details drawer.
          hasLineNumbers={false}
          isTextWrapped={isTextWrapped}
          scrollToRow={scrollToRow}
          theme="dark"
          toolbar={
            <WorkspaceLogsToolbar controller={controller} withSearch onDownload={onDownload} />
          }
          footer={
            <Button
              variant="secondary"
              icon={<AngleDoubleDownIcon />}
              onClick={onScrollToBottom}
              data-testid="logs-scroll-to-bottom-button"
            >
              Jump to the bottom
            </Button>
          }
        />
      )}
    </div>
  );
};
