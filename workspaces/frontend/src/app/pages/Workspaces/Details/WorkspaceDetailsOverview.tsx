import React from 'react';
import {
  DescriptionList,
  DescriptionListTerm,
  DescriptionListGroup,
  DescriptionListDescription,
} from '@patternfly/react-core';
import { Workspace } from '~/shared/types';

type WorkspaceDetailsOverviewProps = {
  workspace: Workspace;
};

export const WorkspaceDetailsOverview: React.FunctionComponent<WorkspaceDetailsOverviewProps> = ({
  workspace,
}) => (
  <DescriptionList>
    <DescriptionListGroup>
      <DescriptionListTerm>Name</DescriptionListTerm>
      <DescriptionListDescription>{workspace.name}</DescriptionListDescription>
    </DescriptionListGroup>
    <DescriptionListGroup>
      <DescriptionListTerm>Kind</DescriptionListTerm>
      <DescriptionListDescription>{workspace.kind}</DescriptionListDescription>
    </DescriptionListGroup>
    <DescriptionListGroup>
      <DescriptionListTerm>Labels</DescriptionListTerm>
      <DescriptionListDescription>
        {workspace.podTemplate.podMetadata.labels.join(', ')}
      </DescriptionListDescription>
    </DescriptionListGroup>
    <DescriptionListGroup>
      <DescriptionListTerm>Pod config</DescriptionListTerm>
      <DescriptionListDescription>{workspace.options.podConfig}</DescriptionListDescription>
    </DescriptionListGroup>
  </DescriptionList>
);
