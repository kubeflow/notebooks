import React from 'react';
import { Content, ContentVariants } from '@patternfly/react-core/dist/esm/components/Content';
import { PageSection } from '@patternfly/react-core/dist/esm/components/Page';
import { Stack, StackItem } from '@patternfly/react-core/dist/esm/layouts/Stack';
import WorkspaceTable from '~/app/components/WorkspaceTable';
import { useWorkspacesByNamespace } from '~/app/hooks/useWorkspaces';
import {
  StreamConnectionStatus,
  useWorkspacesByNamespaceLive,
} from '~/app/hooks/useWorkspacesLive';
import { useNamespaceSelectorWrapper } from '~/app/hooks/useNamespaceSelectorWrapper';
import { LoadingSpinner } from '~/app/components/LoadingSpinner';
import { LoadError } from '~/app/components/LoadError';
import { useWorkspaceRowActions } from '~/app/hooks/useWorkspaceRowActions';
import { ApiWorkspaceListEnvelope, V1Beta1WorkspaceState } from '~/generated/data-contracts';
import { ENABLE_WORKSPACE_STREAM, MOCK_API_ENABLED } from '~/shared/utilities/const';

interface WorkspacesContentProps {
  workspaces: ApiWorkspaceListEnvelope['data'];
  workspacesLoaded: boolean;
  workspacesLoadError: Error | undefined;
  refreshWorkspaces: () => void;
  selectedNamespace: string;
  namespacesLoaded: boolean;
  /** Present only in live (streaming) mode; drives the connection indicator. */
  connectionStatus?: StreamConnectionStatus;
}

// WorkspacesContent renders the workspaces page from an already-resolved data
// source, so it can be shared by both the live (SSE) and polling variants.
const WorkspacesContent: React.FunctionComponent<WorkspacesContentProps> = ({
  workspaces,
  workspacesLoaded,
  workspacesLoadError,
  refreshWorkspaces,
  selectedNamespace,
  namespacesLoaded,
  connectionStatus,
}) => {
  const tableRowActions = useWorkspaceRowActions([
    { id: 'viewDetails' },
    { id: 'edit' },
    { id: 'delete', onActionDone: refreshWorkspaces },
    { id: 'separator' },
    {
      id: 'stop',
      isVisible: (w) => w.state === V1Beta1WorkspaceState.WorkspaceStateRunning,
      onActionDone: refreshWorkspaces,
    },
    {
      id: 'start',
      isVisible: (w) =>
        w.state !== V1Beta1WorkspaceState.WorkspaceStateRunning &&
        w.state !== V1Beta1WorkspaceState.WorkspaceStateError,
      onActionDone: refreshWorkspaces,
    },
  ]);

  if (workspacesLoadError) {
    return <LoadError title="Failed to load workspaces" error={workspacesLoadError} />;
  }

  if (!workspacesLoaded || !namespacesLoaded || selectedNamespace === '') {
    return <LoadingSpinner />;
  }

  return (
    <PageSection isFilled>
      <Stack hasGutter>
        <StackItem>
          <Content component={ContentVariants.h1} data-testid="app-page-title">
            Workspaces
          </Content>
        </StackItem>
        <StackItem>
          <Content component={ContentVariants.p}>
            View your existing workspaces or create new workspaces.
          </Content>
        </StackItem>
        <StackItem isFilled>
          <WorkspaceTable
            workspaces={workspaces}
            rowActions={tableRowActions}
            namespace={selectedNamespace}
            hiddenColumns={['namespace', 'gpu', 'idleGpu']}
            refreshWorkspaces={refreshWorkspaces}
            connectionStatus={connectionStatus}
          />
        </StackItem>
      </Stack>
    </PageSection>
  );
};

// WorkspacesLive drives the table from the Server-Sent Events stream.
const WorkspacesLive: React.FunctionComponent = () => {
  const { namespacesLoaded, selectedNamespace } = useNamespaceSelectorWrapper();
  const {
    fetchState: [workspaces, workspacesLoaded, workspacesLoadError, refreshWorkspaces],
    connectionStatus,
  } = useWorkspacesByNamespaceLive(selectedNamespace);

  return (
    <WorkspacesContent
      workspaces={workspaces}
      workspacesLoaded={workspacesLoaded}
      workspacesLoadError={workspacesLoadError}
      refreshWorkspaces={refreshWorkspaces}
      selectedNamespace={selectedNamespace}
      namespacesLoaded={namespacesLoaded}
      connectionStatus={connectionStatus}
    />
  );
};

// WorkspacesPolling drives the table from the interval-polling fetch hook.
const WorkspacesPolling: React.FunctionComponent = () => {
  const { namespacesLoaded, selectedNamespace } = useNamespaceSelectorWrapper();
  const [workspaces, workspacesLoaded, workspacesLoadError, refreshWorkspaces] =
    useWorkspacesByNamespace(selectedNamespace);

  return (
    <WorkspacesContent
      workspaces={workspaces}
      workspacesLoaded={workspacesLoaded}
      workspacesLoadError={workspacesLoadError}
      refreshWorkspaces={refreshWorkspaces}
      selectedNamespace={selectedNamespace}
      namespacesLoaded={namespacesLoaded}
    />
  );
};

// The streaming vs polling choice is a build-time constant, so exactly one
// branch is rendered for the lifetime of the session — the two variants never
// swap, which keeps their hooks stable. Streaming is disabled under the mock API
// since there is no backend to stream from.
const useLiveStream = ENABLE_WORKSPACE_STREAM && !MOCK_API_ENABLED;

export const Workspaces: React.FunctionComponent = () =>
  useLiveStream ? <WorkspacesLive /> : <WorkspacesPolling />;
