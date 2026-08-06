import React, { useCallback, useMemo, useState } from 'react';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { EmptyState, EmptyStateBody } from '@patternfly/react-core/dist/esm/components/EmptyState';
import { Spinner } from '@patternfly/react-core/dist/esm/components/Spinner';
import { Checkbox } from '@patternfly/react-core/dist/esm/components/Checkbox';
import { Tooltip } from '@patternfly/react-core/dist/esm/components/Tooltip';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { SimpleSelect } from '@patternfly/react-templates';
import { AngleDoubleDownIcon } from '@patternfly/react-icons/dist/esm/icons/angle-double-down-icon';
import { CubesIcon } from '@patternfly/react-icons/dist/esm/icons/cubes-icon';
import { DownloadIcon } from '@patternfly/react-icons/dist/esm/icons/download-icon';
import { ExclamationCircleIcon } from '@patternfly/react-icons/dist/esm/icons/exclamation-circle-icon';
import { SyncAltIcon } from '@patternfly/react-icons/dist/esm/icons/sync-alt-icon';
import { LogViewer, LogViewerSearch } from '@patternfly/react-log-viewer';
import { useWorkspaceLogs } from '~/app/hooks/useWorkspaceLogs';
import { DetailsWorkspaceDetails, WorkspacesWorkspaceListItem } from '~/generated/data-contracts';
import { extractErrorMessage } from '~/shared/api/apiUtils';

// The backend validates `tailLines` as a positive integer, so there is no "all lines" option.
const TAIL_LINES_OPTIONS = [100, 500, 1000, 5000];

const SINCE_OPTIONS: { label: string; windowMs?: number }[] = [
  { label: 'All time' },
  { label: '15 minutes', windowMs: 15 * 60 * 1000 },
  { label: '1 hour', windowMs: 60 * 60 * 1000 },
  { label: '24 hours', windowMs: 24 * 60 * 60 * 1000 },
];

// Each dropdown carries a caption, so that "main" or "1000" on its own is not left unexplained.
// The items share the row evenly and may shrink, so all three fit side by side in the drawer.
const LabelledControl: React.FC<{ label: string; id: string; children: React.ReactNode }> = ({
  label,
  id,
  children,
}) => (
  <FlexItem style={{ flex: '1 1 0', minWidth: 0 }}>
    <div
      id={id}
      style={{
        fontSize: 'var(--pf-t--global--font--size--sm)',
        color: 'var(--pf-t--global--text--color--subtle)',
      }}
    >
      {label}
    </div>
    {children}
  </FlexItem>
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
  const containerNames = useMemo(
    () => (details?.pod?.containers ?? []).map((c) => c.name),
    [details?.pod?.containers],
  );
  const initContainerNames = useMemo(
    () => (details?.pod?.initContainers ?? []).map((c) => c.name),
    [details?.pod?.initContainers],
  );

  const [selectedContainer, setSelectedContainer] = useState<string | undefined>();
  const [tailLines, setTailLines] = useState<number>(1000);
  const [sinceLabel, setSinceLabel] = useState<string>(SINCE_OPTIONS[0].label);
  const [previous, setPrevious] = useState(false);
  const [isTextWrapped, setIsTextWrapped] = useState(false);
  const [scrollToRow, setScrollToRow] = useState<number | undefined>();

  // Default to the primary (first) container of the pod.
  const container = selectedContainer ?? containerNames.at(0) ?? initContainerNames.at(0);

  const sinceTime = useMemo(() => {
    const windowMs = SINCE_OPTIONS.find((option) => option.label === sinceLabel)?.windowMs;
    return windowMs ? new Date(Date.now() - windowMs).toISOString() : undefined;
  }, [sinceLabel]);

  // Only workspaces that currently have a pod can serve logs.
  const hasPod = !!details?.pod;

  const [logs, logsLoaded, logsError, refreshLogs] = useWorkspaceLogs(
    hasPod ? workspace.namespace : undefined,
    hasPod ? workspace.name : undefined,
    { container, tailLines, sinceTime, previous },
  );

  const onDownload = useCallback(() => {
    const blob = new Blob([logs ?? ''], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${workspace.name}-${container ?? 'logs'}.log`;
    link.click();
    URL.revokeObjectURL(url);
  }, [logs, workspace.name, container]);

  const onScrollToBottom = useCallback(() => {
    setScrollToRow((logs ?? '').split('\n').length);
  }, [logs]);

  const containerOptions = useMemo(
    () => [
      ...containerNames.map((name) => ({
        content: name,
        value: name,
        selected: name === container,
      })),
      ...initContainerNames.map((name) => ({
        content: `${name} (init)`,
        value: name,
        selected: name === container,
      })),
    ],
    [containerNames, initContainerNames, container],
  );

  if (detailsError) {
    return (
      <EmptyState
        headingLevel="h4"
        titleText="Unable to load logs"
        icon={ExclamationCircleIcon}
        status="danger"
        data-testid="logs-error-state"
      >
        <EmptyStateBody>Failed to load details</EmptyStateBody>
      </EmptyState>
    );
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

  // A PatternFly Toolbar is not used here: its content row is a flex item with `min-width: auto`,
  // so in the (resizable, often narrow) details drawer it sizes to its content and overflows the
  // panel instead of wrapping. A plain wrapping flex row keeps every control reachable.
  // The search field only works inside the log viewer, as it relies on its context.
  const renderToolbar = (withSearch: boolean) => (
    <Flex
      direction={{ default: 'column' }}
      spaceItems={{ default: 'spaceItemsSm' }}
      style={{ minWidth: 0, maxWidth: '100%' }}
    >
      <Flex
        flexWrap={{ default: 'wrap' }}
        spaceItems={{ default: 'spaceItemsSm' }}
        alignItems={{ default: 'alignItemsFlexEnd' }}
        style={{ minWidth: 0 }}
      >
        <LabelledControl label="Container" id="logs-container-label">
          <SimpleSelect
            initialOptions={containerOptions}
            onSelect={(_ev, selection) => setSelectedContainer(String(selection))}
            toggleProps={{
              'aria-labelledby': 'logs-container-label',
              id: 'logs-container-select',
              style: { width: '100%' },
            }}
          />
        </LabelledControl>
        <LabelledControl label="Lines" id="logs-tail-lines-label">
          <SimpleSelect
            initialOptions={TAIL_LINES_OPTIONS.map((lines) => ({
              content: String(lines),
              value: lines,
              selected: lines === tailLines,
            }))}
            onSelect={(_ev, selection) => setTailLines(Number(selection))}
            toggleProps={{
              'aria-labelledby': 'logs-tail-lines-label',
              id: 'logs-tail-lines-select',
              style: { width: '100%' },
            }}
          />
        </LabelledControl>
        <LabelledControl label="Time range" id="logs-since-label">
          <SimpleSelect
            initialOptions={SINCE_OPTIONS.map((option) => ({
              content: option.label,
              value: option.label,
              selected: option.label === sinceLabel,
            }))}
            onSelect={(_ev, selection) => setSinceLabel(String(selection))}
            toggleProps={{
              'aria-labelledby': 'logs-since-label',
              id: 'logs-since-select',
              style: { width: '100%' },
            }}
          />
        </LabelledControl>
      </Flex>
      {withSearch && (
        <FlexItem>
          <LogViewerSearch placeholder="Search logs" minSearchChars={1} />
        </FlexItem>
      )}
      <Flex
        flexWrap={{ default: 'wrap' }}
        spaceItems={{ default: 'spaceItemsSm' }}
        alignItems={{ default: 'alignItemsCenter' }}
        style={{ minWidth: 0 }}
      >
        <FlexItem>
          <Checkbox
            id="logs-previous-checkbox"
            label="Previous container"
            isChecked={previous}
            onChange={(_ev, checked) => setPrevious(checked)}
            data-testid="logs-previous-checkbox"
          />
        </FlexItem>
        <FlexItem>
          <Checkbox
            id="logs-wrap-checkbox"
            label="Wrap lines"
            isChecked={isTextWrapped}
            onChange={(_ev, checked) => setIsTextWrapped(checked)}
            data-testid="logs-wrap-checkbox"
          />
        </FlexItem>
        <FlexItem>
          <Tooltip content="Refresh logs">
            <Button
              variant="plain"
              aria-label="Refresh logs"
              icon={<SyncAltIcon />}
              onClick={() => refreshLogs()}
              data-testid="logs-refresh-button"
            />
          </Tooltip>
        </FlexItem>
        <FlexItem>
          <Tooltip content="Download logs">
            <Button
              variant="plain"
              aria-label="Download logs"
              icon={<DownloadIcon />}
              isDisabled={!logs}
              onClick={onDownload}
              data-testid="logs-download-button"
            />
          </Tooltip>
        </FlexItem>
      </Flex>
    </Flex>
  );

  let logViewerBody: React.ReactNode = null;
  if (logsError) {
    const message = extractErrorMessage(logsError);
    logViewerBody = (
      <EmptyState
        headingLevel="h4"
        titleText="Unable to load logs"
        icon={ExclamationCircleIcon}
        status="danger"
        data-testid="logs-error-state"
      >
        <EmptyStateBody>
          {typeof message === 'string' ? message : message.error.message}
        </EmptyStateBody>
      </EmptyState>
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
          {previous
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
          {renderToolbar(false)}
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
          toolbar={renderToolbar(true)}
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
