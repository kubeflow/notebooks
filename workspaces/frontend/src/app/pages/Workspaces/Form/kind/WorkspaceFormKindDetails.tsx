import React from 'react';
import { Title } from '@patternfly/react-core/dist/esm/components/Title';
import { WorkspacekindsWorkspaceKind } from '~/generated/data-contracts';

type WorkspaceFormKindDetailsProps = {
  workspaceKind?: WorkspacekindsWorkspaceKind;
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
