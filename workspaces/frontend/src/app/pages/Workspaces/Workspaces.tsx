import { Content, ContentVariants, PageSection } from '@patternfly/react-core';
import * as React from 'react';
import WorkspaceTable from '~/app/components/WorkspaceTable';
import { useNamespaceContext } from '~/app/context/NamespaceContextProvider';
import { useWorkspacesByNamespace } from '~/app/hooks/useWorkspaces';

export const Workspaces: React.FunctionComponent = () => {
  const { selectedNamespace } = useNamespaceContext();
  const [workspaces, workspacesLoaded, workspacesLoadError, workspacesRefresh] =
    useWorkspacesByNamespace(selectedNamespace);

  return (
    <PageSection isFilled>
      <Content component={ContentVariants.h1}>Kubeflow Workspaces</Content>
      <Content component={ContentVariants.p}>
        View your existing workspaces or create new workspaces.
      </Content>
      <WorkspaceTable
        workspaces={workspaces}
        workspacesLoaded={workspacesLoaded}
        workspacesLoadError={workspacesLoadError}
        workspacesRefresh={workspacesRefresh}
      />
    </PageSection>
  );
};
