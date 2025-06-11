import * as React from 'react';
import {
  Button,
  Content,
  ContentVariants,
  PageSection,
  Stack,
  StackItem,
} from '@patternfly/react-core';
import { ArrowLeftIcon } from '@patternfly/react-icons';
import { useTypedLocation, useTypedNavigate, useTypedParams } from '~/app/routerHelper';
import WorkspaceTable from '~/app/components/WorkspaceTable';
import { useWorkspacesByKind } from '~/app/hooks/useWorkspaces';
import WorkspaceKindSummaryExpandableCard from '~/app/pages/WorkspaceKinds/summary/WorkspaceKindSummaryExpandableCard';
import { DEFAULT_POLLING_RATE_MS } from '~/app/const';
import { LoadingSpinner } from '~/app/components/LoadingSpinner';
import { LoadError } from '~/app/components/LoadError';
import { useWorkspaceRowActions } from '~/app/hooks/useWorkspaceRowActions';
import { usePolling } from '~/app/hooks/usePolling';

const WorkspaceKindSummary: React.FC = () => {
  const navigate = useTypedNavigate();
  const [isSummaryExpanded, setIsSummaryExpanded] = React.useState(true);

  const { state } = useTypedLocation<'workspaceKindSummary'>();
  const { namespace, imageId, podConfigId, withGpu, isIdle } = state || {};
  const { kind } = useTypedParams<'workspaceKindSummary'>();
  const [workspaces, workspacesLoaded, workspacesLoadError, refreshWorkspaces] =
    useWorkspacesByKind({
      kind,
      namespace,
      imageId,
      podConfigId,
      isIdle,
      withGpu,
    });

  usePolling(refreshWorkspaces, DEFAULT_POLLING_RATE_MS);

  const tableRowActions = useWorkspaceRowActions([{ id: 'viewDetails' }]);

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
          <Button
            variant="link"
            icon={<ArrowLeftIcon />}
            iconPosition="left"
            onClick={() => navigate('workspaceKinds')}
            aria-label="Back to Workspace Kinds"
          >
            Back
          </Button>
        </StackItem>
        <StackItem>
          <Content component={ContentVariants.h1}>Workspace Kind Summary</Content>
          <Content component={ContentVariants.p}>
            View a summary of your workspaces and their GPU usage.
          </Content>
        </StackItem>
        <StackItem>
          <WorkspaceKindSummaryExpandableCard
            workspaces={workspaces}
            isExpanded={isSummaryExpanded}
            onExpandToggle={() => setIsSummaryExpanded(!isSummaryExpanded)}
          />
        </StackItem>
        <StackItem isFilled>
          <WorkspaceTable
            workspaces={workspaces}
            canCreateWorkspaces={false}
            hiddenColumns={['connect']}
            rowActions={tableRowActions}
          />
        </StackItem>
      </Stack>
    </PageSection>
  );
};

export default WorkspaceKindSummary;
