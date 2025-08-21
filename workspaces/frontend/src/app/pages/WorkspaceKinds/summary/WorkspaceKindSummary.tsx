import React, { useCallback, useRef, useState } from 'react';
import { Content, ContentVariants } from '@patternfly/react-core/dist/esm/components/Content';
import { PageSection } from '@patternfly/react-core/dist/esm/components/Page';
import { Stack, StackItem } from '@patternfly/react-core/dist/esm/layouts/Stack';
import { Breadcrumb } from '@patternfly/react-core/dist/esm/components/Breadcrumb';
import { BreadcrumbItem } from '@patternfly/react-core/dist/esm/components/Breadcrumb/BreadcrumbItem';
import { useTypedLocation, useTypedNavigate, useTypedParams } from '~/app/routerHelper';
import WorkspaceTable, { WorkspaceTableRef } from '~/app/components/WorkspaceTable';
import { useWorkspacesByKind } from '~/app/hooks/useWorkspaces';
import WorkspaceKindSummaryExpandableCard from '~/app/pages/WorkspaceKinds/summary/WorkspaceKindSummaryExpandableCard';
import { LoadingSpinner } from '~/app/components/LoadingSpinner';
import { LoadError } from '~/app/components/LoadError';
import { useWorkspaceRowActions } from '~/app/hooks/useWorkspaceRowActions';
import { usePolling } from '~/app/hooks/usePolling';
import { POLL_INTERVAL } from '~/shared/utilities/const';

const WorkspaceKindSummary: React.FC = () => {
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(true);

  const navigate = useTypedNavigate();
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

  usePolling(refreshWorkspaces, POLL_INTERVAL);

  const tableRowActions = useWorkspaceRowActions([{ id: 'viewDetails' }]);

  const onAddFilter = useCallback(
    (columnKey: string, value: string) => {
      if (!workspaceTableRef.current) {
        return;
      }
      // Map to valid filter keys from WorkspaceTable
      const validKeys = ['name', 'kind', 'image', 'state', 'namespace', 'idleGpu'] as const;
      type ValidKey = (typeof validKeys)[number];

      if (validKeys.includes(columnKey as ValidKey)) {
        workspaceTableRef.current.setFilter(columnKey as ValidKey, value);
      }
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
    <PageSection>
      <Stack hasGutter>
        <StackItem>
          <Breadcrumb>
            <BreadcrumbItem component="button" onClick={() => navigate('workspaceKinds')}>
              Workspace Kinds
            </BreadcrumbItem>
            <BreadcrumbItem to="#" isActive>
              Workspaces in {kind}
            </BreadcrumbItem>
          </Breadcrumb>
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
        <StackItem>
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
