import * as React from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerContentBody,
  PageSection,
  Content,
  Brand,
  Tooltip,
  Label,
} from '@patternfly/react-core';
import {
  Table,
  Thead,
  Tr,
  Th,
  Tbody,
  Td,
  ThProps,
  ActionsColumn,
  IActions,
} from '@patternfly/react-table';
import {
  CodeIcon,
} from '@patternfly/react-icons';
import { useState } from 'react';
import { WorkspaceKind, WorkspaceKindsColumnNames } from '~/shared/types';
import Filter, { FilteredColumn } from 'shared/components/Filter';
import useWorkspaceKinds from '~/app/hooks/useWorkspaceKinds';
export enum ActionType {
  ViewDetails,
}

export const WorkspaceKinds: React.FunctionComponent = () => {

  const mockNumberOfWorkspaces = 1 // Todo: create a function to calculate number of workspaces for each workspace kind.

  // Table columns
  const columnNames: WorkspaceKindsColumnNames = {
    icon: '',
    name: 'Name',
    description: 'Description',
    deprecated: 'Status',
    numberOfWorkspaces: 'Number Of Workspaces',

  };

  const filterableColumns = {
    name: 'Name',
    deprecated: 'Status',
  };
  
  const [initialWorkspaceKinds] = useWorkspaceKinds();;
  const [workspaceKinds, setWorkspaceKinds] = useState<WorkspaceKind[]>(initialWorkspaceKinds);
  const [expandedWorkspaceKindsNames, setExpandedWorkspaceKindsNames] = React.useState<string[]>([]);
  const [selectedWorkspaceKind, setSelectedWorkspacekind] = React.useState<WorkspaceKind | null>(null);
  const [activeActionType, setActiveActionType] = React.useState<ActionType | null>(null);

  const setWorkspaceKindsExpanded = (workspaceKind: WorkspaceKind, isExpanding = true) =>
    setExpandedWorkspaceKindsNames((prevExpanded) => {
      const newExpandedWorkspaceKindsNames = prevExpanded.filter((wsName) => wsName !== workspaceKind.name);
      return isExpanding
        ? [...newExpandedWorkspaceKindsNames, workspaceKind.name]
        : newExpandedWorkspaceKindsNames;
    });

  const isWorkspaceKindExpanded = (workspaceKind: WorkspaceKind) =>
    expandedWorkspaceKindsNames.includes(workspaceKind.name);

  // filter function to pass to the filter component
  const onFilter = (filters: FilteredColumn[]) => {
    // Search name with search value
    let filteredWorkspaceKinds = initialWorkspaceKinds;
    filters.forEach((filter) => {
      let searchValueInput: RegExp;
      try {
        searchValueInput = new RegExp(filter.value, 'i');
      } catch {
        searchValueInput = new RegExp(filter.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      }

      filteredWorkspaceKinds = filteredWorkspaceKinds.filter((workspaceKind) => {
        if (filter.value === '') {
          return true;
        }
        switch (filter.columnName) {
          case columnNames.name:
            return workspaceKind.name.search(searchValueInput) >= 0;
          case columnNames.deprecated:
            if (filter.value.toUpperCase() === "ACTIVE") {
              return workspaceKind.deprecated === false;
            } else if (filter.value.toUpperCase() === "DEPRECATED") {
              return workspaceKind.deprecated === true;
            }
            return true
          default:
            return true;
        }
      });
    });
    setWorkspaceKinds(filteredWorkspaceKinds);
  };

  // Column sorting

  const [activeSortIndex, setActiveSortIndex] = React.useState<number | null>(null);
  const [activeSortDirection, setActiveSortDirection] = React.useState<'asc' | 'desc' | null>(null);

  const getSortableRowValues = (workspaceKind: WorkspaceKind): (string | boolean | number)[] => {
    const { icon, name, description, deprecated, numOfWrokspaces} =
      {
        icon: "",
        name: workspaceKind.name,
        description: workspaceKind.description,
        deprecated: workspaceKind.deprecated,
        numOfWrokspaces: mockNumberOfWorkspaces,
      };
    return [icon, name, description, deprecated, numOfWrokspaces];
  };

  let sortedWorkspaceKinds = workspaceKinds;
  if (activeSortIndex !== null) {
    sortedWorkspaceKinds = workspaceKinds.sort((a, b) => {
      const aValue = getSortableRowValues(a)[activeSortIndex];
      const bValue = getSortableRowValues(b)[activeSortIndex];
      if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
        // Convert boolean to number (true -> 1, false -> 0) for sorting
        return activeSortDirection === 'asc'
          ? Number(aValue) - Number(bValue)
          : Number(bValue) - Number(aValue);
      }
      // String sort
      if (activeSortDirection === 'asc') {
        return (aValue as string).localeCompare(bValue as string);
      }
      return (bValue as string).localeCompare(aValue as string);
    });
  }

  const getSortParams = (columnIndex: number): ThProps['sort'] => ({
      sortBy: {
        index: activeSortIndex || 0,
        direction: activeSortDirection || 'asc',
        defaultDirection: 'asc', // starting sort direction when first sorting a column. Defaults to 'asc'
      },
      onSort: (_event, index, direction) => {
        setActiveSortIndex(index);
        setActiveSortDirection(direction);
      },
      columnIndex,
    });

  // Actions

  const viewDetailsClick = React.useCallback((workspaceKind: WorkspaceKind) => {
    setSelectedWorkspacekind(workspaceKind);
    setActiveActionType(ActionType.ViewDetails);
  }, []);

  const workspaceKindsDefaultActions = (workspaceKind: WorkspaceKind): IActions => {
    const workspaceKindsActions = [
      {
        id: 'view-details',
        title: 'View Details',
        onClick: () => viewDetailsClick(workspaceKind),
      },
      {
        isSeparator: true,
      },
      
    ] as IActions;

    return workspaceKindsActions;
  };

  const workspaceDetailsContent = null // Todo: Detail need to be implemented.

  const DESCRIPTION_CHAR_LIMIT = 50;

  return (
    <Drawer
      isInline
      isExpanded={selectedWorkspaceKind != null && activeActionType === ActionType.ViewDetails}
    >
      <DrawerContent panelContent={workspaceDetailsContent}>
        <DrawerContentBody>
          <PageSection isFilled>
            <Content>
              <h1>Kubeflow Workspace Kinds</h1>
              <p>View your existing workspace kinds.</p>
            </Content>
            <br />
            <Content style={{ display: 'flex', alignItems: 'flex-start', columnGap: '20px' }}>
              <Filter id="filter-workspace-kinds" onFilter={onFilter} columnNames={filterableColumns} />
              {/* <Button variant="primary" ouiaId="Primary">
                Create Workspace Kind // Todo: show only in case of an admin user.
              </Button> */} 
            </Content>
            <Table aria-label="Sortable table" ouiaId="SortableTable">
              <Thead>
                <Tr>
                  <Th />
                  {Object.values(columnNames).map((columnName, index) => (
                    <Th
                      key={`${columnName}-col-name`}
                      sort={columnName === 'Name' || columnName === 'Status'? getSortParams(index) : undefined}
                    >
                      {columnName}
                    </Th>
                  ))}
                  <Th screenReaderText="Primary action" />
                </Tr>
              </Thead>
              {sortedWorkspaceKinds.map((workspaceKind, rowIndex) => (
                <Tbody
                  id="workspace-kind-table-content"
                  key={rowIndex}
                  isExpanded={isWorkspaceKindExpanded(workspaceKind)}
                  data-testid="table-body"
                >
                  <Tr id={`workspace-kind-table-row-${rowIndex + 1}`}>
                    <Td
                      expand={{
                        rowIndex,
                        isExpanded: isWorkspaceKindExpanded(workspaceKind),
                        onToggle: () =>
                          setWorkspaceKindsExpanded(workspaceKind, !isWorkspaceKindExpanded(workspaceKind)),
                      }}
                    />
                    <Td dataLabel={columnNames.icon} style={{ width: '50px' }}>{workspaceKind.icon.url ? (
                        <Brand
                          src={workspaceKind.icon.url}
                          alt={workspaceKind.name}
                          style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                        />
                      ) : (
                        <CodeIcon />
                      )}
                    </Td>
                    <Td dataLabel={columnNames.name}>
                      {workspaceKind.name}
                    </Td>
                    <Td dataLabel={columnNames.description} style={{ maxWidth: '200px', overflow: 'hidden' }}>
                      <Tooltip content={workspaceKind.description}>
                        <span>
                          {workspaceKind.description.length > DESCRIPTION_CHAR_LIMIT ? 
                          `${workspaceKind.description.slice(0, DESCRIPTION_CHAR_LIMIT)}...` : workspaceKind.description}
                        </span>
                      </Tooltip>
                    </Td>
                    <Td dataLabel={columnNames.deprecated}>
                    {workspaceKind.deprecated ? (
                      <Label color="red">Deprecated</Label>
                    ) : (
                      <Tooltip content={workspaceKind.deprecationMessage}>
                        <Label color="green">Active</Label>
                      </Tooltip>
                    )}
                    </Td>
                    <Td dataLabel={columnNames.numberOfWorkspaces}>{mockNumberOfWorkspaces}</Td>

                    <Td isActionCell data-testid="action-column">
                      <ActionsColumn
                        items={workspaceKindsDefaultActions(workspaceKind).map((action) => ({
                          ...action,
                          'data-testid': `action-${action.id || ''}`,
                        }))}
                      />
                    </Td>
                  </Tr>
                </Tbody>
              ))}
            </Table>
          </PageSection>
        </DrawerContentBody>
      </DrawerContent>
    </Drawer>
  );
};
