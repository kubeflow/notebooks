import * as React from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerContentBody,
  PageSection,
  TimestampTooltipVariant,
  Timestamp,
  Label,
  PaginationVariant,
  Pagination,
  Button,
  Content,
  Tooltip,
  Brand,
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
import { useState } from 'react';
import { CodeIcon } from '@patternfly/react-icons';
import { Workspace, WorkspacesColumnNames, WorkspaceState } from '~/shared/types';
import { WorkspaceDetails } from '~/app/pages/Workspaces/Details/WorkspaceDetails';
import { ExpandedWorkspaceRow } from '~/app/pages/Workspaces/ExpandedWorkspaceRow';
import DeleteModal from '~/shared/components/DeleteModal';
import { buildKindLogoDictionary } from '~/app/actions/WorkspaceKindsActions';
import useWorkspaceKinds from '~/app/hooks/useWorkspaceKinds';
import Filter, { FilteredColumn } from 'shared/components/Filter';
import { formatRam } from 'shared/utilities/WorkspaceResources';

export const Workspaces: React.FunctionComponent = () => {
  /* Mocked workspaces, to be removed after fetching info from backend */
  const mockWorkspaces: Workspace[] = [
    {
      name: 'My Jupyter Notebook',
      namespace: 'namespace1',
      paused: true,
      deferUpdates: true,
      kind: 'jupyter-lab',
      cpu: 3,
      ram: 500,
      podTemplate: {
        podMetadata: {
          labels: ['label1', 'label2'],
          annotations: ['annotation1', 'annotation2'],
        },
        volumes: {
          home: '/home',
          data: [
            {
              pvcName: 'Volume-1',
              mountPath: '/data',
              readOnly: true,
            },
            {
              pvcName: 'Volume-2',
              mountPath: '/data',
              readOnly: false,
            },
          ],
        },
      },
      options: {
        imageConfig: 'jupyterlab_scipy_180',
        podConfig: 'Small CPU',
      },
      status: {
        activity: {
          lastActivity: 0,
          lastUpdate: 0,
        },
        pauseTime: 0,
        pendingRestart: false,
        podTemplateOptions: {
          imageConfig: {
            desired: '',
            redirectChain: [],
          },
        },
        state: WorkspaceState.Paused,
        stateMessage: 'It is paused.',
      },
    },
    {
      name: 'My Other Jupyter Notebook',
      namespace: 'namespace1',
      paused: false,
      deferUpdates: false,
      kind: 'jupyter-lab',
      cpu: 1,
      ram: 12540,
      podTemplate: {
        podMetadata: {
          labels: ['label1', 'label2'],
          annotations: ['annotation1', 'annotation2'],
        },
        volumes: {
          home: '/home',
          data: [
            {
              pvcName: 'PVC-1',
              mountPath: '/data',
              readOnly: false,
            },
          ],
        },
      },
      options: {
        imageConfig: 'jupyterlab_scipy_180',
        podConfig: 'Large CPU',
      },
      status: {
        activity: {
          lastActivity: 0,
          lastUpdate: 0,
        },
        pauseTime: 0,
        pendingRestart: false,
        podTemplateOptions: {
          imageConfig: {
            desired: '',
            redirectChain: [],
          },
        },
        state: WorkspaceState.Running,
        stateMessage: 'It is running.',
      },
    },
  ];

  const [workspaceKinds] = useWorkspaceKinds();
  let kindLogoDict: Record<string, string> = {};
  kindLogoDict = buildKindLogoDictionary(workspaceKinds);

  // Table columns
  const columnNames: WorkspacesColumnNames = {
    name: 'Name',
    kind: 'Kind',
    image: 'Image',
    podConfig: 'Pod Config',
    state: 'State',
    homeVol: 'Home Vol',
    cpu: 'CPU',
    ram: 'Memory',
    lastActivity: 'Last Activity',
  };

  const filterableColumns: WorkspacesColumnNames = {
    name: 'Name',
    kind: 'Kind',
    image: 'Image',
    podConfig: 'Pod Config',
    state: 'State',
    homeVol: 'Home Vol',
    lastActivity: 'Last Activity',
  };

  // change when fetch workspaces is implemented
  const initialWorkspaces = mockWorkspaces;
  const [workspaces, setWorkspaces] = useState(initialWorkspaces);
  const [expandedWorkspacesNames, setExpandedWorkspacesNames] = React.useState<string[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = React.useState<Workspace | null>(null);
  const [workspaceToDelete, setWorkspaceToDelete] = React.useState<Workspace | null>(null);

  const selectWorkspace = React.useCallback(
    (newSelectedWorkspace) => {
      if (selectedWorkspace?.name === newSelectedWorkspace?.name) {
        setSelectedWorkspace(null);
      } else {
        setSelectedWorkspace(newSelectedWorkspace);
      }
    },
    [selectedWorkspace],
  );
  const setWorkspaceExpanded = (workspace: Workspace, isExpanding = true) =>
    setExpandedWorkspacesNames((prevExpanded) => {
      const newExpandedWorkspacesNames = prevExpanded.filter((wsName) => wsName !== workspace.name);
      return isExpanding
        ? [...newExpandedWorkspacesNames, workspace.name]
        : newExpandedWorkspacesNames;
    });

  const isWorkspaceExpanded = (workspace: Workspace) =>
    expandedWorkspacesNames.includes(workspace.name);

  // filter function to pass to the filter component
  const onFilter = (filters: FilteredColumn[]) => {
    // Search name with search value
    let filteredWorkspaces = initialWorkspaces;
    filters.forEach((filter) => {
      let searchValueInput: RegExp;
      try {
        searchValueInput = new RegExp(filter.value, 'i');
      } catch {
        searchValueInput = new RegExp(filter.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      }

      filteredWorkspaces = filteredWorkspaces.filter((workspace) => {
        if (filter.value === '') {
          return true;
        }
        switch (filter.columnName) {
          case columnNames.name:
            return workspace.name.search(searchValueInput) >= 0;
          case columnNames.kind:
            return workspace.kind.search(searchValueInput) >= 0;
          case columnNames.image:
            return workspace.options.imageConfig.search(searchValueInput) >= 0;
          case columnNames.podConfig:
            return workspace.options.podConfig.search(searchValueInput) >= 0;
          case columnNames.state:
            return WorkspaceState[workspace.status.state].search(searchValueInput) >= 0;
          case columnNames.homeVol:
            return workspace.podTemplate.volumes.home.search(searchValueInput) >= 0;
          default:
            return true;
        }
      });
    });
    setWorkspaces(filteredWorkspaces);
  };

  // Column sorting

  const [activeSortIndex, setActiveSortIndex] = React.useState<number | null>(null);
  const [activeSortDirection, setActiveSortDirection] = React.useState<'asc' | 'desc' | null>(null);

  const getSortableRowValues = (workspace: Workspace): (string | number)[] => {
    const { name, kind, image, podConfig, state, homeVol, cpu, ram, lastActivity } = {
      name: workspace.name,
      kind: workspace.kind,
      image: workspace.options.imageConfig,
      podConfig: workspace.options.podConfig,
      state: WorkspaceState[workspace.status.state],
      homeVol: workspace.podTemplate.volumes.home,
      cpu: workspace.cpu,
      ram: workspace.ram,
      lastActivity: workspace.status.activity.lastActivity,
    };
    return [name, kind, image, podConfig, state, homeVol, cpu, ram, lastActivity];
  };

  let sortedWorkspaces = workspaces;
  if (activeSortIndex !== null) {
    sortedWorkspaces = workspaces.sort((a, b) => {
      const aValue = getSortableRowValues(a)[activeSortIndex];
      const bValue = getSortableRowValues(b)[activeSortIndex];
      if (typeof aValue === 'number') {
        // Numeric sort
        if (activeSortDirection === 'asc') {
          return (aValue as number) - (bValue as number);
        }
        return (bValue as number) - (aValue as number);
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

  const editAction = React.useCallback((workspace: Workspace) => {
    console.log(`Clicked on edit, on row ${workspace.name}`);
  }, []);

  const deleteAction = React.useCallback((workspace: Workspace) => {
    console.log(`Clicked on delete, on row ${workspace.name}`);
  }, []);

  const startRestartAction = React.useCallback((workspace: Workspace) => {
    console.log(`Clicked on start/restart, on row ${workspace.name}`);
  }, []);

  const stopAction = React.useCallback((workspace: Workspace) => {
    console.log(`Clicked on stop, on row ${workspace.name}`);
  }, []);

  const handleDeleteClick = React.useCallback((workspace: Workspace) => {
    const buttonElement = document.activeElement as HTMLElement;
    buttonElement.blur(); // Remove focus from the currently focused button
    setWorkspaceToDelete(workspace); // Open the modal and set workspace to delete
  }, []);

  const defaultActions = React.useCallback(
    (workspace: Workspace): IActions =>
      [
        {
          title: 'View Details',
          onClick: () => selectWorkspace(workspace),
        },
        {
          title: 'Edit',
          onClick: () => editAction(workspace),
        },
        {
          title: 'Delete',
          onClick: () => handleDeleteClick(workspace),
        },
        {
          isSeparator: true,
        },
        {
          title: 'Start/restart',
          onClick: () => startRestartAction(workspace),
        },
        {
          title: 'Stop',
          onClick: () => stopAction(workspace),
        },
      ] as IActions,
    [selectWorkspace, editAction, handleDeleteClick, startRestartAction, stopAction],
  );

  // States

  const stateColors: (
    | 'blue'
    | 'teal'
    | 'green'
    | 'orange'
    | 'purple'
    | 'red'
    | 'orangered'
    | 'grey'
    | 'yellow'
  )[] = ['green', 'orange', 'yellow', 'blue', 'red', 'purple'];

  // Pagination

  const [page, setPage] = React.useState(1);
  const [perPage, setPerPage] = React.useState(10);

  const onSetPage = (
    _event: React.MouseEvent | React.KeyboardEvent | MouseEvent,
    newPage: number,
  ) => {
    setPage(newPage);
  };

  const onPerPageSelect = (
    _event: React.MouseEvent | React.KeyboardEvent | MouseEvent,
    newPerPage: number,
    newPage: number,
  ) => {
    setPerPage(newPerPage);
    setPage(newPage);
  };

  const workspaceDetailsContent = (
    <>
      {selectedWorkspace && (
        <WorkspaceDetails
          workspace={selectedWorkspace}
          onCloseClick={() => selectWorkspace(null)}
          onEditClick={() => editAction(selectedWorkspace)}
          onDeleteClick={() => handleDeleteClick(selectedWorkspace)}
        />
      )}
    </>
  );

  return (
    <Drawer isInline isExpanded={selectedWorkspace != null}>
      <DrawerContent panelContent={workspaceDetailsContent}>
        <DrawerContentBody>
          <PageSection isFilled>
            <Content>
              <h1>Kubeflow Workspaces</h1>
              <p>View your existing workspaces or create new workspaces.</p>
            </Content>
            <br />
            <Content style={{ display: 'flex', alignItems: 'flex-start', columnGap: '20px' }}>
              <Filter id="filter-workspaces" onFilter={onFilter} columnNames={filterableColumns} />
              <Button variant="primary" ouiaId="Primary">
                Create Workspace
              </Button>
            </Content>
            <Table aria-label="Sortable table" ouiaId="SortableTable">
              <Thead>
                <Tr>
                  <Th />
                  {Object.values(columnNames).map((columnName, index) => (
                    <Th key={`${columnName}-col-name`} sort={getSortParams(index)}>
                      {columnName}
                    </Th>
                  ))}
                  <Th screenReaderText="Primary action" />
                </Tr>
              </Thead>
              {sortedWorkspaces.map((workspace, rowIndex) => (
                <Tbody
                  id="workspaces-table-content"
                  key={rowIndex}
                  isExpanded={isWorkspaceExpanded(workspace)}
                  data-testid="table-body"
                >
                  <Tr id={`workspaces-table-row-${rowIndex + 1}`}>
                    <Td
                      expand={{
                        rowIndex,
                        isExpanded: isWorkspaceExpanded(workspace),
                        onToggle: () =>
                          setWorkspaceExpanded(workspace, !isWorkspaceExpanded(workspace)),
                      }}
                    />
                    <Td dataLabel={columnNames.name}>{workspace.name}</Td>
                    <Td dataLabel={columnNames.kind}>
                      {kindLogoDict[workspace.kind] ? (
                        <Tooltip content={workspace.kind}>
                          <Brand
                            src={kindLogoDict[workspace.kind]}
                            alt={workspace.kind}
                            style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                          />
                        </Tooltip>
                      ) : (
                        <Tooltip content={workspace.kind}>
                          <CodeIcon />
                        </Tooltip>
                      )}
                    </Td>
                    <Td dataLabel={columnNames.image}>{workspace.options.imageConfig}</Td>
                    <Td dataLabel={columnNames.podConfig}>{workspace.options.podConfig}</Td>
                    <Td dataLabel={columnNames.state}>
                      <Label color={stateColors[workspace.status.state]}>
                        {WorkspaceState[workspace.status.state]}
                      </Label>
                    </Td>
                    <Td dataLabel={columnNames.homeVol}>{workspace.podTemplate.volumes.home}</Td>
                    <Td dataLabel={columnNames.cpu}>{`${workspace.cpu}%`}</Td>
                    <Td dataLabel={columnNames.ram}>{formatRam(workspace.ram)}</Td>
                    <Td dataLabel={columnNames.lastActivity}>
                      <Timestamp
                        date={new Date(workspace.status.activity.lastActivity)}
                        tooltip={{ variant: TimestampTooltipVariant.default }}
                      >
                        1 hour ago
                      </Timestamp>
                    </Td>
                    <Td isActionCell data-testid="action-column">
                      <ActionsColumn
                        items={defaultActions(workspace).map((action) => ({
                          ...action,
                          'data-testid': `action-${typeof action.title === 'string' ? action.title.toLowerCase() : ''}`,
                        }))}
                      />
                    </Td>
                  </Tr>
                  {isWorkspaceExpanded(workspace) && (
                    <ExpandedWorkspaceRow workspace={workspace} columnNames={columnNames} />
                  )}
                </Tbody>
              ))}
            </Table>
            <DeleteModal
              isOpen={workspaceToDelete != null}
              resourceName={workspaceToDelete?.name || ''}
              namespace={workspaceToDelete?.namespace || ''}
              title="Delete Workspace?"
              onClose={() => setWorkspaceToDelete(null)}
              onDelete={() => workspaceToDelete && deleteAction(workspaceToDelete)}
            />
            <Pagination
              itemCount={333}
              widgetId="bottom-example"
              perPage={perPage}
              page={page}
              variant={PaginationVariant.bottom}
              isCompact
              onSetPage={onSetPage}
              onPerPageSelect={onPerPageSelect}
            />
          </PageSection>
        </DrawerContentBody>
      </DrawerContent>
    </Drawer>
  );
};
