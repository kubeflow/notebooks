import React from 'react';
import { Tr, Td, ExpandableRowContent } from '@patternfly/react-table/dist/esm/components/Table';
import { WorkspaceTableColumnKeys } from '~/app/components/WorkspaceTable';
import { WorkspacesWorkspace } from '~/generated/data-contracts';
import { WorkspaceStorage } from './WorkspaceStorage';
import { WorkspacePackageDetails } from './WorkspacePackageDetails';
import { WorkspaceConfigDetails } from './WorkspaceConfigDetails';

interface ExpandedWorkspaceRowProps {
  workspace: WorkspacesWorkspace;
  visibleColumnKeys: WorkspaceTableColumnKeys[];
  canExpandRows: boolean;
}

export const ExpandedWorkspaceRow: React.FC<ExpandedWorkspaceRowProps> = ({
  workspace,
  visibleColumnKeys,
  canExpandRows,
}) => {
  // Calculate total number of columns (including expand column if present)
  const totalColumns = visibleColumnKeys.length + (canExpandRows ? 1 : 0);

  // Find the positions where we want to show our content
  // We'll show storage in the first content column, package details in the second,
  // and config details in the third
  const getColumnIndex = (columnKey: WorkspaceTableColumnKeys) => {
    const baseIndex = canExpandRows ? 1 : 0; // Account for expand column
    return baseIndex + visibleColumnKeys.indexOf(columnKey);
  };

  const storageColumnIndex = visibleColumnKeys.includes('name') ? getColumnIndex('name') : 1;
  const packageColumnIndex = visibleColumnKeys.includes('image') ? getColumnIndex('image') : 2;
  const configColumnIndex = visibleColumnKeys.includes('kind') ? getColumnIndex('kind') : 3;

  return (
    <Tr isExpanded>
      {/* Render cells for each column */}
      {Array.from({ length: totalColumns }, (_, index) => {
        if (index === storageColumnIndex) {
          return (
            <Td key={`storage-${index}`} dataLabel="Storage" modifier="nowrap">
              <ExpandableRowContent>
                <WorkspaceStorage workspace={workspace} />
              </ExpandableRowContent>
            </Td>
          );
        }

        if (index === packageColumnIndex) {
          return (
            <Td key={`package-${index}`} modifier="nowrap">
              <ExpandableRowContent>
                <WorkspacePackageDetails workspace={workspace} />
              </ExpandableRowContent>
            </Td>
          );
        }

        if (index === configColumnIndex) {
          return (
            <Td key={`config-${index}`} modifier="nowrap">
              <ExpandableRowContent>
                <WorkspaceConfigDetails workspace={workspace} />
              </ExpandableRowContent>
            </Td>
          );
        }

        // Empty cell for all other columns
        return <Td key={`empty-${index}`} />;
      })}
    </Tr>
  );
};
