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

const WorkspaceKindSummary: React.FC = () => {
  const navigate = useTypedNavigate();
  const [isSummaryExpanded, setIsSummaryExpanded] = React.useState(true);

  const {
    state: { namespace, imageId, podConfigId, withGpu, isIdle },
  } = useTypedLocation<'workspaceKindSummary'>();
  const { kind } = useTypedParams<'workspaceKindSummary'>();
  const [workspaces, workspacesLoaded, workspacesLoadError, workspacesRefresh] =
    useWorkspacesByKind({
      kind,
      namespace,
      imageId,
      podConfigId,
      isIdle,
      withGpu,
    });

  if (workspacesLoadError) {
    return <p>Error loading workspaces: {workspacesLoadError.message}</p>; // TODO: UX for error state
  }

  if (!workspacesLoaded) {
    return <p>Loading...</p>; // TODO: UX for loading state
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
        <StackItem>
          <WorkspaceTable
            workspaces={workspaces}
            workspacesRefresh={workspacesRefresh}
            canCreateWorkspaces={false}
            hiddenColumns={['connect']}
          />
        </StackItem>
      </Stack>
    </PageSection>
  );
};

export default WorkspaceKindSummary;
