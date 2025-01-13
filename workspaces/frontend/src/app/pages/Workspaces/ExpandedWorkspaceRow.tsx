import * as React from 'react';
import { ExpandableRowContent, Td, Tr } from '@patternfly/react-table';
import { Workspace, WorkspacesColumnNames } from '~/shared/types';
import { DataVolumesList } from '~/app/pages/Workspaces/DataVolumesList';

interface ExpandedWorkspaceRowProps {
  workspace: Workspace;
  columnNames: WorkspacesColumnNames;
}

export const ExpandedWorkspaceRow: React.FC<ExpandedWorkspaceRowProps> = ({
  workspace,
  columnNames,
}) => {
  const renderExpandedData = () =>
    Object.keys(columnNames).map((colName) => {
      switch (colName) {
        case 'name':
          return (
            <Td noPadding colSpan={1}>
              <ExpandableRowContent>
                <DataVolumesList workspace={workspace} />
              </ExpandableRowContent>
            </Td>
          );
        default:
          return <Td />;
      }
    });

  return (
    <Tr>
      <Td />
      {renderExpandedData()}
    </Tr>
  );
};
