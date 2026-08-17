import React from 'react';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { Checkbox } from '@patternfly/react-core/dist/esm/components/Checkbox';
import { Tooltip } from '@patternfly/react-core/dist/esm/components/Tooltip';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { SimpleSelect } from '@patternfly/react-templates';
import { DownloadIcon } from '@patternfly/react-icons/dist/esm/icons/download-icon';
import { SyncAltIcon } from '@patternfly/react-icons/dist/esm/icons/sync-alt-icon';
import { LogViewerSearch } from '@patternfly/react-log-viewer';
import {
  TAIL_LINES_OPTIONS,
  SINCE_OPTIONS,
  WorkspaceLogsController,
} from '~/app/hooks/useWorkspaceLogs';

// Each dropdown carries a caption, so that "main" or "1000" on its own is not left unexplained.
// The items share the row evenly and may shrink, so all three fit side by side in the drawer.
const LabelledControl: React.FC<{ label: string; id: string; children: React.ReactNode }> = ({
  label,
  id,
  children,
}) => (
  <FlexItem style={{ flex: '1 1 0', minWidth: 0 }}>
    <div id={id} className="pf-v6-u-font-size-sm pf-v6-u-text-color-subtle">
      {label}
    </div>
    {children}
  </FlexItem>
);

interface WorkspaceLogsToolbarProps {
  controller: WorkspaceLogsController;
  /** The search field only works inside the LogViewer, as it relies on its context. */
  withSearch: boolean;
  onDownload: () => void;
}

// A PatternFly Toolbar is not used here: its content row is a flex item with `min-width: auto`,
// so in the (resizable, often narrow) details drawer it sizes to its content and overflows the
// panel instead of wrapping. A plain wrapping flex row keeps every control reachable.
export const WorkspaceLogsToolbar: React.FC<WorkspaceLogsToolbarProps> = ({
  controller,
  withSearch,
  onDownload,
}) => {
  const {
    containerOptions,
    activeContainerKey,
    selectContainer,
    tailLines,
    setTailLines,
    sinceLabel,
    setSinceLabel,
    previous,
    setPrevious,
    isTextWrapped,
    setIsTextWrapped,
    logs,
    refreshLogs,
  } = controller;

  return (
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
            initialOptions={containerOptions.map((option) => ({
              content: option.isInit ? `${option.name} (init)` : option.name,
              value: option.key,
              selected: option.key === activeContainerKey,
            }))}
            onSelect={(_ev, selection) => selectContainer(String(selection))}
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
          <Tooltip content="Show logs from the previous, terminated container instance instead of the current one. Useful for debugging a crash loop.">
            <Checkbox
              id="logs-previous-checkbox"
              label="Previous container"
              isChecked={previous}
              onChange={(_ev, checked) => setPrevious(checked)}
              data-testid="logs-previous-checkbox"
            />
          </Tooltip>
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
};
