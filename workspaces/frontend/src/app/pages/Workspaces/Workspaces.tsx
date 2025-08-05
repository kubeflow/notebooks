import * as React from 'react';
import { Content, ContentVariants } from '@patternfly/react-core/dist/esm/components/Content';
import { PageSection } from '@patternfly/react-core/dist/esm/components/Page';
import { Stack, StackItem } from '@patternfly/react-core/dist/esm/layouts/Stack';
import WorkspaceTable from '~/app/components/WorkspaceTable';
import { useNamespaceContext } from '~/app/context/NamespaceContextProvider';
import { useWorkspacesByNamespace } from '~/app/hooks/useWorkspaces';
import { DEFAULT_POLLING_RATE_MS } from '~/app/const';
import { LoadingSpinner } from '~/app/components/LoadingSpinner';
import { LoadError } from '~/app/components/LoadError';
import { useWorkspaceRowActions } from '~/app/hooks/useWorkspaceRowActions';
import { usePolling } from '~/app/hooks/usePolling';
import { WorkspacesWorkspaceState } from '~/generated/data-contracts';

export const Workspaces: React.FunctionComponent = () => {
  const { selectedNamespace } = useNamespaceContext();

  const [workspaces, workspacesLoaded, workspacesLoadError, refreshWorkspaces] =
    useWorkspacesByNamespace(selectedNamespace);

  usePolling(refreshWorkspaces, DEFAULT_POLLING_RATE_MS);

  const tableRowActions = useWorkspaceRowActions([
    { id: 'viewDetails' },
    { id: 'edit', isVisible: false }, // TODO: enable it when edit action is fully supported
    { id: 'delete', onActionDone: refreshWorkspaces },
    { id: 'separator' },
    {
      id: 'stop',
      isVisible: (w) => w.state === WorkspacesWorkspaceState.WorkspaceStateRunning,
      onActionDone: refreshWorkspaces,
    },
    {
      id: 'start',
      isVisible: (w) => w.state !== WorkspacesWorkspaceState.WorkspaceStateRunning,
      onActionDone: refreshWorkspaces,
    },
    {
      id: 'restart',
      isVisible: (w) => w.state === WorkspacesWorkspaceState.WorkspaceStateRunning,
      onActionDone: refreshWorkspaces,
    },
  ]);

  if (workspacesLoadError) {
    return <LoadError error={workspacesLoadError} />;
  }

  if (!workspacesLoaded) {
    return <LoadingSpinner />;
  }

  return (
    <PageSection isFilled>
      <Stack hasGutter>
        <StackItem>
          <Content component={ContentVariants.h1}>Workspaces</Content>
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
            hiddenColumns={['namespace', 'gpu', 'idleGpu']}
          />
        </StackItem>
      </Stack>
    </PageSection>
  );
};
