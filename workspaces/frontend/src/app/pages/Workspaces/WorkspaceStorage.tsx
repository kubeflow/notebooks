import * as React from 'react';
import {
  DescriptionList,
  DescriptionListTerm,
  DescriptionListGroup,
  DescriptionListDescription,
} from '@patternfly/react-core/dist/esm/components/DescriptionList';
import { Workspace } from '~/shared/api/backendApiTypes';
import { DataVolumesList } from '~/app/pages/Workspaces/DataVolumesList';

interface WorkspaceStorageProps {
  workspace: Workspace;
}

export const WorkspaceStorage: React.FC<WorkspaceStorageProps> = ({ workspace }) => (
  <DescriptionList>
    <DescriptionListGroup>
      <DescriptionListTerm>Home volume</DescriptionListTerm>
      <DescriptionListDescription>
        {workspace.podTemplate.volumes.home?.pvcName ?? 'None'}
      </DescriptionListDescription>
    </DescriptionListGroup>
    <DescriptionListGroup>
      <DataVolumesList workspace={workspace} />
    </DescriptionListGroup>
  </DescriptionList>
);
