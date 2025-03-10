import React from 'react';
import { Title } from '@patternfly/react-core';
import { WorkspaceKind } from '~/shared/types';

type WorkspaceCreationKindDetailsProps = {
  workspaceKind?: WorkspaceKind;
};

export const WorkspaceCreationKindDetails: React.FunctionComponent<
  WorkspaceCreationKindDetailsProps
> = ({ workspaceKind }) => (
  <>
    {!workspaceKind && <p>Select a workspace kind to view its details here.</p>}

    {workspaceKind && (
      <>
        <Title headingLevel="h6">Workspace kind</Title>
        <Title headingLevel="h3">{workspaceKind.name}</Title>
        <p>{workspaceKind.description}</p>
      </>
    )}
  </>
);
