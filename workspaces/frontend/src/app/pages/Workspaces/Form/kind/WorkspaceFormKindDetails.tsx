import React from 'react';
import { Title } from '@patternfly/react-core';
import { WorkspaceKind } from '~/shared/api/backendApiTypes';

type WorkspaceFormKindDetailsProps = {
  workspaceKind?: WorkspaceKind;
};

export const WorkspaceFormKindDetails: React.FunctionComponent<WorkspaceFormKindDetailsProps> = ({
  workspaceKind,
}) => (
  <>
    {workspaceKind && (
      <>
        <Title headingLevel="h3">{workspaceKind.displayName}</Title>
        <p>{workspaceKind.description}</p>
      </>
    )}
  </>
);
