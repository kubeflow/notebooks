import React from 'react';
import {
  DescriptionList,
  DescriptionListTerm,
  DescriptionListGroup,
  DescriptionListDescription,
} from '@patternfly/react-core/dist/esm/components/DescriptionList';
import { Divider } from '@patternfly/react-core/dist/esm/components/Divider';
import { Workspace } from '~/shared/api/backendApiTypes';

type WorkspaceDetailsOverviewProps = {
  workspace: Workspace;
};

export const WorkspaceDetailsOverview: React.FunctionComponent<WorkspaceDetailsOverviewProps> = ({
  workspace,
}) => (
  <DescriptionList isHorizontal>
    <DescriptionListGroup>
      <DescriptionListTerm>Name</DescriptionListTerm>
      <DescriptionListDescription>{workspace.name}</DescriptionListDescription>
    </DescriptionListGroup>
    <Divider />
    <DescriptionListGroup>
      <DescriptionListTerm>Kind</DescriptionListTerm>
      <DescriptionListDescription>{workspace.workspaceKind.name}</DescriptionListDescription>
    </DescriptionListGroup>
    <Divider />
    <DescriptionListGroup>
      <DescriptionListTerm>Labels</DescriptionListTerm>
      <DescriptionListDescription>
        {Object.entries(workspace.podTemplate.podMetadata.labels)
          .map(([key, value]) => `${key}=${value}`)
          .join(', ')}
      </DescriptionListDescription>
    </DescriptionListGroup>
    <Divider />
    <DescriptionListGroup>
      <DescriptionListTerm>Pod config</DescriptionListTerm>
      <DescriptionListDescription>
        {workspace.podTemplate.options.podConfig.current.displayName}
      </DescriptionListDescription>
    </DescriptionListGroup>
    <Divider />
  </DescriptionList>
);
