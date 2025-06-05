import * as React from 'react';
import { ExpandableRowContent, Td, Tr } from '@patternfly/react-table';
import { Workspace } from '~/shared/api/backendApiTypes';
import { DataVolumesList } from '~/app/pages/Workspaces/DataVolumesList';

interface ExpandedWorkspaceRowProps {
  workspace: Workspace;
}

export const ExpandedWorkspaceRow: React.FC<ExpandedWorkspaceRowProps> = ({ workspace }) => (
  <Tr>
    <Td colSpan={3} />
    <Td noPadding colSpan={3}>
      <ExpandableRowContent>
        <DataVolumesList workspace={workspace} />
      </ExpandableRowContent>
    </Td>
    <Td colSpan={7} />
  </Tr>
);
