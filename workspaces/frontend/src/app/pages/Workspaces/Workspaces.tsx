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
  Brand,
  Tooltip,
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
  InfoCircleIcon,
  ExclamationTriangleIcon,
  TimesCircleIcon,
  QuestionCircleIcon,
  CodeIcon,
} from '@patternfly/react-icons';
import { useState } from 'react';
import { Workspace, WorkspacesColumnNames, WorkspaceState } from '~/shared/types';
import { WorkspaceDetails } from '~/app/pages/Workspaces/Details/WorkspaceDetails';
import { ExpandedWorkspaceRow } from '~/app/pages/Workspaces/ExpandedWorkspaceRow';
import DeleteModal from '~/shared/components/DeleteModal';
import {
  buildKindLogoDictionary,
  buildWorkspaceRedirectStatus,
} from '~/app/actions/WorkspaceKindsActions';
import useWorkspaceKinds from '~/app/hooks/useWorkspaceKinds';
import { WorkspaceConnectAction } from '~/app/pages/Workspaces/WorkspaceConnectAction';
import { WorkspaceStartActionModal } from '~/app/pages/Workspaces/workspaceActions/WorkspaceStartActionModal';
import { WorkspaceRestartActionModal } from '~/app/pages/Workspaces/workspaceActions/WorkspaceRestartActionModal';
import { WorkspaceStopActionModal } from '~/app/pages/Workspaces/workspaceActions/WorkspaceStopActionModal';
import Filter, { FilteredColumn } from 'shared/components/Filter';
import { formatRam } from 'shared/utilities/WorkspaceUtils';

export enum ActionType {
  ViewDetails,
  Edit,
  Delete,
  Start,
  Restart,
  Stop,
}

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
        endpoints: [
          {
            displayName: 'JupyterLab',
            port: '7777',
          },
        ],
      },
      options: {
        imageConfig: 'jupyterlab_scipy_180',
        podConfig: 'Small CPU',
      },
      status: {
        activity: {
          lastActivity: 1739673600,
          lastUpdate: 1739673700,
        },
        pauseTime: 1739673500,
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
      redirectStatus: {
        level: 'Info',
        text: 'This is informational', // Tooltip text
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
        endpoints: [
          {
            displayName: 'JupyterLab',
            port: '8888',
          },
          {
            displayName: 'Spark Master',
            port: '9999',
          },
        ],
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
      redirectStatus: {
        level: 'Danger',
        text: 'This is dangerous',
      },
    },
  ];

  const [workspaceKinds] = useWorkspaceKinds();
  let kindLogoDict: Record<string, string> = {};
  kindLogoDict = buildKindLogoDictionary(workspaceKinds);

  let workspaceRedirectStatus: Record<
    string,
    { to: string; message: string; level: string } | null
  > = {}; // Initialize the redirect status dictionary
  workspaceRedirectStatus = buildWorkspaceRedirectStatus(workspaceKinds); // Populate the dictionary

  // Table columns
  const columnNames: WorkspacesColumnNames = {
    redirectStatus: 'Redirect Status',
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

  const filterableColumns = {
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
  const [workspaces, setWorkspaces] = useState<Workspace[]>(initialWorkspaces);
  const [expandedWorkspacesNames, setExpandedWorkspacesNames] = React.useState<string[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = React.useState<Workspace | null>(null);
  const [workspaceToDelete, setWorkspaceToDelete] = React.useState<Workspace | null>(null);
  const [isActionAlertModalOpen, setIsActionAlertModalOpen] = React.useState(false);
  const [activeActionType, setActiveActionType] = React.useState<ActionType | null>(null);

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
    const { redirectStatus, name, kind, image, podConfig, state, homeVol, cpu, ram, lastActivity } =
      {
        redirectStatus: '',
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
    return [redirectStatus, name, kind, image, podConfig, state, homeVol, cpu, ram, lastActivity];
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

  const viewDetailsClick = React.useCallback((workspace: Workspace) => {
    setSelectedWorkspace(workspace);
    setActiveActionType(ActionType.ViewDetails);
  }, []);

  const editAction = React.useCallback((workspace: Workspace) => {
    setSelectedWorkspace(workspace);
    setActiveActionType(ActionType.Edit);
  }, []);

  const deleteAction = React.useCallback((workspace: Workspace) => {
    setSelectedWorkspace(workspace);
    setActiveActionType(ActionType.Delete);
  }, []);

  const startRestartAction = React.useCallback((workspace: Workspace, action: ActionType) => {
    setSelectedWorkspace(workspace);
    setActiveActionType(action);
    setIsActionAlertModalOpen(true);
  }, []);

  const stopAction = React.useCallback((workspace: Workspace) => {
    setSelectedWorkspace(workspace);
    setActiveActionType(ActionType.Stop);
    setIsActionAlertModalOpen(true);
  }, []);

  const handleDeleteClick = React.useCallback((workspace: Workspace) => {
    const buttonElement = document.activeElement as HTMLElement;
    buttonElement.blur(); // Remove focus from the currently focused button
    setWorkspaceToDelete(workspace); // Open the modal and set workspace to delete
  }, []);

  const onCloseActionAlertDialog = () => {
    setIsActionAlertModalOpen(false);
    setSelectedWorkspace(null);
    setActiveActionType(null);
  };

  const workspaceDefaultActions = (workspace: Workspace): IActions => {
    const workspaceState = workspace.status.state;
    const workspaceActions = [
      {
        id: 'view-details',
        title: 'View Details',
        onClick: () => viewDetailsClick(workspace),
      },
      {
        id: 'edit',
        title: 'Edit',
        onClick: () => editAction(workspace),
      },
      {
        id: 'delete',
        title: 'Delete',
        onClick: () => handleDeleteClick(workspace),
      },
      {
        isSeparator: true,
      },
      workspaceState !== WorkspaceState.Running
        ? {
            id: 'start',
            title: 'Start',
            onClick: () => startRestartAction(workspace, ActionType.Start),
          }
        : {
            id: 'restart',
            title: 'Restart',
            onClick: () => startRestartAction(workspace, ActionType.Restart),
          },
    ] as IActions;

    if (workspaceState === WorkspaceState.Running) {
      workspaceActions.push({
        id: 'stop',
        title: 'Stop',
        onClick: () => stopAction(workspace),
      });
    }
    return workspaceActions;
  };

  const chooseAlertModal = () => {
    switch (activeActionType) {
      case ActionType.Start:
        return (
          <WorkspaceStartActionModal
            onClose={onCloseActionAlertDialog}
            isOpen={isActionAlertModalOpen}
            workspace={selectedWorkspace}
          />
        );
      case ActionType.Restart:
        return (
          <WorkspaceRestartActionModal
            onClose={onCloseActionAlertDialog}
            isOpen={isActionAlertModalOpen}
            workspace={selectedWorkspace}
          />
        );
      case ActionType.Stop:
        return (
          <WorkspaceStopActionModal
            onClose={onCloseActionAlertDialog}
            isOpen={isActionAlertModalOpen}
            workspace={selectedWorkspace}
          />
        );
    }
    return undefined;
  };

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

  // Redirect Status Icons

  const getRedirectStatusIcon = (level: string | undefined, message: string) => {
    switch (level) {
      case 'Info':
        return (
          <Tooltip content={message}>
            <InfoCircleIcon color="blue" aria-hidden="true" />
          </Tooltip>
        );
      case 'Warning':
        return (
          <Tooltip content={message}>
            <ExclamationTriangleIcon color="orange" aria-hidden="true" />
          </Tooltip>
        );
      case 'Danger':
        return (
          <Tooltip content={message}>
            <TimesCircleIcon color="red" aria-hidden="true" />
          </Tooltip>
        );
      case undefined:
        return (
          <Tooltip content={message}>
            <QuestionCircleIcon color="gray" aria-hidden="true" />
          </Tooltip>
        );
      default:
        return (
          <Tooltip content={`Invalid level: ${level}`}>
            <QuestionCircleIcon color="gray" aria-hidden="true" />
          </Tooltip>
        );
    }
  };

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
    <Drawer
      isInline
      isExpanded={selectedWorkspace != null && activeActionType === ActionType.ViewDetails}
    >
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
                    <Th
                      key={`${columnName}-col-name`}
                      sort={columnName !== 'Redirect Status' ? getSortParams(index) : undefined}
                    >
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
                    <Td dataLabel={columnNames.redirectStatus}>
                      {workspaceRedirectStatus[workspace.kind]
                        ? getRedirectStatusIcon(
                            workspaceRedirectStatus[workspace.kind]?.level,
                            workspaceRedirectStatus[workspace.kind]?.message ||
                              'No API response available',
                          )
                        : getRedirectStatusIcon(undefined, 'No API response available')}
                    </Td>
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
                    <Td>
                      <WorkspaceConnectAction workspace={workspace} />
                    </Td>
                    <Td isActionCell data-testid="action-column">
                      <ActionsColumn
                        items={workspaceDefaultActions(workspace).map((action) => ({
                          ...action,
                          'data-testid': `action-${action.id || ''}`,
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
            {isActionAlertModalOpen && chooseAlertModal()}
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
