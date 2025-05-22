import React from 'react';
import { Title } from '@patternfly/react-core';
import { WorkspaceKind } from '~/shared/api/backendApiTypes';

type WorkspaceFormKindDetailsProps = {
  workspaceKind?: WorkspaceKind;
};

export const WorkspaceFormKindDetails: React.FunctionComponent<WorkspaceFormKindDetailsProps> = ({
  workspaceKind,
}) => (
  <div style={{ marginLeft: 'var(--pf-t--global--spacer--md)' }}>
    {workspaceKind && (
      <>
        <Title headingLevel="h3">{workspaceKind.name}</Title>
        <p>{workspaceKind.description}</p>
      </>
    )}
  </div>
);
