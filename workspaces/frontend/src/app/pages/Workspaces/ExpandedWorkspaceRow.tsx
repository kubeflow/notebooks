import React from 'react';
import { ExpandableRowContent, Td, Tr } from '@patternfly/react-table';
import { Workspace } from '~/shared/api/backendApiTypes';
import { DataVolumesList } from '~/app/pages/Workspaces/DataVolumesList';
import { WorkspacesColumnNames } from '~/app/types';

interface ExpandedWorkspaceRowProps {
  workspace: Workspace;
  columnNames: WorkspacesColumnNames;
}

export const ExpandedWorkspaceRow: React.FC<ExpandedWorkspaceRowProps> = ({
  workspace,
  columnNames,
}) => {
  const renderExpandedData = () =>
    Object.keys(columnNames).map((colName, index) => {
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
