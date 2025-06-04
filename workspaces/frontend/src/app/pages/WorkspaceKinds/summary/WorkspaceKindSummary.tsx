import React, { useCallback, useRef, useState } from 'react';
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
import WorkspaceTable, {
  WorkspaceTableFilteredColumn,
  WorkspaceTableRef,
} from '~/app/components/WorkspaceTable';
import { useWorkspacesByKind } from '~/app/hooks/useWorkspaces';
import WorkspaceKindSummaryExpandableCard from '~/app/pages/WorkspaceKinds/summary/WorkspaceKindSummaryExpandableCard';
import { DEFAULT_POLLING_RATE_MS } from '~/app/const';
import { LoadingSpinner } from '~/app/components/LoadingSpinner';
import { LoadError } from '~/app/components/LoadError';
import { useWorkspaceRowActions } from '~/app/hooks/useWorkspaceRowActions';
import { usePolling } from '~/app/hooks/usePolling';

const WorkspaceKindSummary: React.FC = () => {
  const navigate = useTypedNavigate();
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(true);

  const { state } = useTypedLocation<'workspaceKindSummary'>();
  const { namespace, imageId, podConfigId } = state || {};
  const { kind } = useTypedParams<'workspaceKindSummary'>();
  const workspaceTableRef = useRef<WorkspaceTableRef>(null);
  const [workspaces, workspacesLoaded, workspacesLoadError, refreshWorkspaces] =
    useWorkspacesByKind({
      kind,
      namespace,
      imageId,
      podConfigId,
    });

  usePolling(refreshWorkspaces, DEFAULT_POLLING_RATE_MS);

  const tableRowActions = useWorkspaceRowActions([{ id: 'viewDetails' }]);

  const onAddFilter = useCallback(
    (filter: WorkspaceTableFilteredColumn) => {
      if (!workspaceTableRef.current) {
        return;
      }
      workspaceTableRef.current.addFilter(filter);
    },
    [workspaceTableRef],
  );

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
          <Content component={ContentVariants.h1}>{kind}</Content>
          <Content component={ContentVariants.p}>
            View a summary of your workspaces and their GPU usage.
          </Content>
        </StackItem>
        <StackItem>
          <WorkspaceKindSummaryExpandableCard
            workspaces={workspaces}
            isExpanded={isSummaryExpanded}
            onExpandToggle={() => setIsSummaryExpanded(!isSummaryExpanded)}
            onAddFilter={onAddFilter}
          />
        </StackItem>
        <StackItem isFilled>
          <WorkspaceTable
            ref={workspaceTableRef}
            workspaces={workspaces}
            canCreateWorkspaces={false}
            hiddenColumns={['connect', 'kind']}
            rowActions={tableRowActions}
          />
        </StackItem>
      </Stack>
    </PageSection>
  );
};

export default WorkspaceKindSummary;
