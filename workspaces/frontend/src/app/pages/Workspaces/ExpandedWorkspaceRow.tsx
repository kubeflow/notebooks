import * as React from 'react';
import { ExpandableRowContent, Td, Tr } from '@patternfly/react-table';
import { Workspace } from '~/shared/types';
import { DataVolumesList } from '~/app/pages/Workspaces/DataVolumesList';

interface ExpandedWorkspaceRowProps {
  workspace: Workspace;
}

export const ExpandedWorkspaceRow: React.FC<ExpandedWorkspaceRowProps> = ({ workspace }) => (
  <Tr>
    <Td />
    <Td />
    <Td noPadding colSpan={3}>
      <ExpandableRowContent>
        <DataVolumesList workspace={workspace} />
      </ExpandableRowContent>
    </Td>
    <Td colSpan={8} />
  </Tr>
);
