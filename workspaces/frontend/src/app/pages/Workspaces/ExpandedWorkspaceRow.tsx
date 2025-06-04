import React from 'react';
import { Tr, Td, ExpandableRowContent } from '@patternfly/react-table';
import { Workspace } from '~/shared/api/backendApiTypes';
import { WorkspaceStorage } from './WorkspaceStorage';
import { WorkspacePackageDetails } from './WorkspacePackageDetails';
import { WorkspaceConfigDetails } from './WorkspaceConfigDetails';

// Import the type from WorkspaceTable
export type WorkspaceTableColumnKeys =
  | 'name'
  | 'kind'
  | 'namespace'
  | 'image'
  | 'state'
  | 'gpu'
  | 'idleGpu'
  | 'lastActivity'
  | 'connect'
  | 'actions';

interface ExpandedWorkspaceRowProps {
  workspace: Workspace;
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
  const configColumnIndex = visibleColumnKeys.includes('image') ? getColumnIndex('image') : 2;
  const packageColumnIndex = visibleColumnKeys.includes('kind') ? getColumnIndex('kind') : 3;

  return (
    <Tr isExpanded>
      {/* Render cells for each column */}
      {Array.from({ length: totalColumns }, (_, index) => {
        if (index === storageColumnIndex) {
          return (
            <Td key={`storage-${index}`} dataLabel="Storage">
              <ExpandableRowContent>
                <WorkspaceStorage workspace={workspace} />
              </ExpandableRowContent>
            </Td>
          );
        }

        if (index === packageColumnIndex) {
          return (
            <Td key={`package-${index}`}>
              <ExpandableRowContent>
                <WorkspacePackageDetails workspace={workspace} />
              </ExpandableRowContent>
            </Td>
          );
        }

        if (index === configColumnIndex) {
          return (
            <Td key={`config-${index}`}>
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
