import React from 'react';
import {
  DescriptionList,
  DescriptionListTerm,
  DescriptionListGroup,
  DescriptionListDescription,
} from '@patternfly/react-core/dist/esm/components/DescriptionList';
import { formatResourceFromWorkspace } from '~/shared/utilities/WorkspaceUtils';
import { WorkspacesWorkspace } from '~/generated/data-contracts';

interface WorkspaceConfigDetailsProps {
  workspace: WorkspacesWorkspace;
}

export const WorkspaceConfigDetails: React.FC<WorkspaceConfigDetailsProps> = ({ workspace }) => (
  <DescriptionList>
    <DescriptionListGroup>
      <DescriptionListTerm>Pod config</DescriptionListTerm>
      <DescriptionListDescription>
        {workspace.podTemplate.options.podConfig.current.displayName}
      </DescriptionListDescription>
    </DescriptionListGroup>
    <DescriptionListGroup>
      <DescriptionListTerm>CPU</DescriptionListTerm>
      <DescriptionListDescription>
        {formatResourceFromWorkspace(workspace, 'cpu')}
      </DescriptionListDescription>
    </DescriptionListGroup>
    <DescriptionListGroup>
      <DescriptionListTerm>Memory</DescriptionListTerm>
      <DescriptionListDescription>
        {formatResourceFromWorkspace(workspace, 'memory')}
      </DescriptionListDescription>
    </DescriptionListGroup>
  </DescriptionList>
);
