import { Content, ContentVariants, PageSection } from '@patternfly/react-core';
import * as React from 'react';
import WorkspaceTable from '~/app/components/WorkspaceTable';
import { useNamespaceContext } from '~/app/context/NamespaceContextProvider';
import { useWorkspacesByNamespace } from '~/app/hooks/useWorkspaces';

export const Workspaces: React.FunctionComponent = () => {
  const { selectedNamespace } = useNamespaceContext();
  const [workspaces, workspacesLoaded, workspacesLoadError, workspacesRefresh] =
    useWorkspacesByNamespace(selectedNamespace);

  if (workspacesLoadError) {
    return <p>Error loading workspaces: {workspacesLoadError.message}</p>; // TODO: UX for error state
  }

  if (!workspacesLoaded) {
    return <p>Loading...</p>; // TODO: UX for loading state
  }

  return (
    <PageSection isFilled>
      <Content component={ContentVariants.h1}>Kubeflow Workspaces</Content>
      <Content component={ContentVariants.p}>
        View your existing workspaces or create new workspaces.
      </Content>
      <WorkspaceTable workspaces={workspaces} workspacesRefresh={workspacesRefresh} />
    </PageSection>
  );
};
