import React from 'react';
import { ExpandableRowContent, Td, Tr } from '@patternfly/react-table';
import { Workspace } from '~/shared/api/backendApiTypes';
import { DataVolumesList } from '~/app/pages/Workspaces/DataVolumesList';
import { WorkspaceTableColumnKey } from '~/app/components/WorkspaceTable';

interface ExpandedWorkspaceRowProps {
  workspace: Workspace;
  columnKeys: WorkspaceTableColumnKey[];
}

export const ExpandedWorkspaceRow: React.FC<ExpandedWorkspaceRowProps> = ({
  workspace,
  columnKeys,
}) => {
  const renderExpandedData = () =>
    columnKeys.map((colName, index) => {
      switch (colName) {
        case 'name':
          return (
            <Td noPadding colSpan={1} key={index}>
              <ExpandableRowContent>
                <DataVolumesList workspace={workspace} />
              </ExpandableRowContent>
            </Td>
          );
        default:
          return <Td key={index} />;
      }
    });

  return (
    <Tr>
      <Td />
      {renderExpandedData()}
    </Tr>
  );
};
