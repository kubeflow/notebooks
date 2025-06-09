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
  Content,
  Brand,
  Tooltip,
  Bullseye,
  Button,
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
import { formatDistanceToNow } from 'date-fns';
import { Workspace, WorkspaceState } from '~/shared/api/backendApiTypes';
import { DataFieldKey, defineDataFields, FilterableDataFieldKey } from '~/app/filterableDataHelper';
import { WorkspaceDetails } from '~/app/pages/Workspaces/Details/WorkspaceDetails';
import { ExpandedWorkspaceRow } from '~/app/pages/Workspaces/ExpandedWorkspaceRow';
import DeleteModal from '~/shared/components/DeleteModal';
import { useTypedNavigate } from '~/app/routerHelper';
import {
  buildKindLogoDictionary,
  buildWorkspaceRedirectStatus,
} from '~/app/actions/WorkspaceKindsActions';
import useWorkspaceKinds from '~/app/hooks/useWorkspaceKinds';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { WorkspaceConnectAction } from '~/app/pages/Workspaces/WorkspaceConnectAction';
import { WorkspaceStartActionModal } from '~/app/pages/Workspaces/workspaceActions/WorkspaceStartActionModal';
import { WorkspaceRestartActionModal } from '~/app/pages/Workspaces/workspaceActions/WorkspaceRestartActionModal';
import { WorkspaceStopActionModal } from '~/app/pages/Workspaces/workspaceActions/WorkspaceStopActionModal';
import { useNamespaceContext } from '~/app/context/NamespaceContextProvider';
import CustomEmptyState from '~/shared/components/CustomEmptyState';
import Filter, { FilteredColumn, FilterRef } from '~/shared/components/Filter';
import { formatResourceFromWorkspace } from '~/shared/utilities/WorkspaceUtils';
import { FetchStateRefreshPromise } from '~/shared/utilities/useFetchState';

export enum ActionType {
  ViewDetails,
  Edit,
  Delete,
  Start,
  Restart,
  Stop,
}

const {
  fields: wsTableColumns,
  keyArray: wsTableColumnKeyArray,
  filterableKeyArray: filterableWsTableColumnKeyArray,
} = defineDataFields({
  redirectStatus: { label: 'Redirect Status', isFilterable: false },
  name: { label: 'Name', isFilterable: true },
  kind: { label: 'Kind', isFilterable: true },
  image: { label: 'Image', isFilterable: true },
  podConfig: { label: 'Pod Config', isFilterable: true },
  state: { label: 'State', isFilterable: true },
  homeVol: { label: 'Home Vol', isFilterable: true },
  cpu: { label: 'CPU', isFilterable: false },
  ram: { label: 'Memory', isFilterable: false },
  lastActivity: { label: 'Last Activity', isFilterable: false },
  connect: { label: '', isFilterable: false },
  actions: { label: '', isFilterable: false },
});

export type WorkspaceTableColumnKeys = DataFieldKey<typeof wsTableColumns>;
type WorkspaceTableFilterableColumnKeys = FilterableDataFieldKey<typeof wsTableColumns>;

interface WorkspaceTableProps {
  workspaces: Workspace[];
  workspacesRefresh: FetchStateRefreshPromise<Workspace[]>;
  canCreateWorkspaces?: boolean;
  canExpandRows?: boolean;
  initialFilters?: FilteredColumn[];
  hiddenColumns?: WorkspaceTableColumnKeys[];
}

const WorkspaceTable: React.FC<WorkspaceTableProps> = ({
  workspaces,
  workspacesRefresh,
  canCreateWorkspaces = true,
  canExpandRows = true,
  initialFilters = [],
  hiddenColumns = [],
}) => {
  const { api } = useNotebookAPI();
  const { selectedNamespace } = useNamespaceContext();

  const [workspaceKinds] = useWorkspaceKinds();
  const [expandedWorkspacesNames, setExpandedWorkspacesNames] = React.useState<string[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = React.useState<Workspace | null>(null);
  const [isActionAlertModalOpen, setIsActionAlertModalOpen] = React.useState(false);
  const [activeActionType, setActiveActionType] = React.useState<ActionType | null>(null);
  const [filters, setFilters] = React.useState<FilteredColumn[]>(initialFilters);
  const [activeSortIndex, setActiveSortIndex] = React.useState<number | null>(null);
  const [activeSortDirection, setActiveSortDirection] = React.useState<'asc' | 'desc' | null>(null);
  const [page, setPage] = React.useState(1);
  const [perPage, setPerPage] = React.useState(10);

  const navigate = useTypedNavigate();
  const filterRef = React.useRef<FilterRef>(null);
  const kindLogoDict = buildKindLogoDictionary(workspaceKinds);
  const workspaceRedirectStatus = buildWorkspaceRedirectStatus(workspaceKinds);

  const visibleColumnKeys: WorkspaceTableColumnKeys[] = React.useMemo(
    () =>
      hiddenColumns.length
        ? wsTableColumnKeyArray.filter((col) => !hiddenColumns.includes(col))
        : wsTableColumnKeyArray,
    [hiddenColumns],
  );

  const visibleFilterableColumns = React.useMemo(() => {
    const keys =
      hiddenColumns.length > 0
        ? filterableWsTableColumnKeyArray.filter((col) => !hiddenColumns.includes(col))
        : filterableWsTableColumnKeyArray;

    return Object.fromEntries(keys.map((key) => [key, wsTableColumns[key].label])) as Record<
      WorkspaceTableFilterableColumnKeys,
      string
    >;
  }, [hiddenColumns]);

  React.useEffect(() => {
    if (activeActionType !== ActionType.Edit || !selectedWorkspace) {
      return;
    }
    navigate('workspaceEdit', {
      state: {
        namespace: selectedWorkspace.namespace,
        workspaceName: selectedWorkspace.name,
      },
    });
  }, [activeActionType, navigate, selectedWorkspace]);

  const selectWorkspace = React.useCallback(
    (newSelectedWorkspace: Workspace | null) => {
      if (selectedWorkspace?.name === newSelectedWorkspace?.name) {
        setSelectedWorkspace(null);
      } else {
        setSelectedWorkspace(newSelectedWorkspace);
      }
    },
    [selectedWorkspace],
  );

  const createWorkspace = React.useCallback(() => {
    navigate('workspaceCreate');
  }, [navigate]);

  const setWorkspaceExpanded = (workspace: Workspace, isExpanding = true) =>
    setExpandedWorkspacesNames((prevExpanded) => {
      const newExpandedWorkspacesNames = prevExpanded.filter((wsName) => wsName !== workspace.name);
      return isExpanding
        ? [...newExpandedWorkspacesNames, workspace.name]
        : newExpandedWorkspacesNames;
    });

  const isWorkspaceExpanded = (workspace: Workspace) =>
    expandedWorkspacesNames.includes(workspace.name);

  const filteredWorkspaces = React.useMemo(() => {
    if (workspaces.length === 0) {
      return [];
    }

    return filters.reduce((result, filter) => {
      let searchValueInput: RegExp;
      try {
        searchValueInput = new RegExp(filter.value, 'i');
      } catch {
        searchValueInput = new RegExp(filter.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      }

      return result.filter((ws) => {
        switch (filter.columnKey as WorkspaceTableFilterableColumnKeys) {
          case 'name':
            return ws.name.match(searchValueInput);
          case 'kind':
            return ws.workspaceKind.name.match(searchValueInput);
          case 'image':
            return ws.podTemplate.options.imageConfig.current.displayName.match(searchValueInput);
          case 'podConfig':
            return ws.podTemplate.options.podConfig.current.displayName.match(searchValueInput);
          case 'state':
            return ws.state.match(searchValueInput);
          case 'homeVol':
            return ws.podTemplate.volumes.home?.mountPath.match(searchValueInput);
          default:
            return true;
        }
      });
    }, workspaces);
  }, [workspaces, filters]);

  // Column sorting

  const getSortableRowValues = (
    workspace: Workspace,
  ): Record<WorkspaceTableColumnKeys, string | number> => ({
    redirectStatus: '',
    name: workspace.name,
    kind: workspace.workspaceKind.name,
    image: workspace.podTemplate.options.imageConfig.current.displayName,
    podConfig: workspace.podTemplate.options.podConfig.current.displayName,
    state: workspace.state,
    homeVol: workspace.podTemplate.volumes.home?.pvcName ?? '',
    cpu: formatResourceFromWorkspace(workspace, 'cpu'),
    ram: formatResourceFromWorkspace(workspace, 'memory'),
    lastActivity: workspace.activity.lastActivity,
    connect: '',
    actions: '',
  });

  const sortedWorkspaces = React.useMemo(() => {
    if (activeSortIndex === null) {
      return filteredWorkspaces;
    }

    const columnKey = visibleColumnKeys[activeSortIndex];
    return [...filteredWorkspaces].sort((a, b) => {
      const aValue = getSortableRowValues(a)[columnKey];
      const bValue = getSortableRowValues(b)[columnKey];

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        // Numeric sort
        return activeSortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }
      // String sort
      return activeSortDirection === 'asc'
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue));
    });
  }, [filteredWorkspaces, activeSortIndex, activeSortDirection, visibleColumnKeys]);

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

  // TODO: Uncomment when edit action is fully supported
  // const editAction = React.useCallback((workspace: Workspace) => {
  //   setSelectedWorkspace(workspace);
  //   setActiveActionType(ActionType.Edit);
  // }, []);

  const deleteAction = React.useCallback(async () => {
    if (!selectedWorkspace) {
      return;
    }

    try {
      await api.deleteWorkspace({}, selectedNamespace, selectedWorkspace.name);
      // TODO: alert user about success
      console.info(`Workspace '${selectedWorkspace.name}' deleted successfully`);
      await workspacesRefresh();
    } catch (err) {
      // TODO: alert user about error
      console.error(`Error deleting workspace '${selectedWorkspace.name}': ${err}`);
    }
  }, [api, workspacesRefresh, selectedNamespace, selectedWorkspace]);

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
    setSelectedWorkspace(workspace);
    setActiveActionType(ActionType.Delete);
  }, []);

  const onCloseActionAlertDialog = () => {
    setIsActionAlertModalOpen(false);
    setSelectedWorkspace(null);
    setActiveActionType(null);
  };

  const workspaceDefaultActions = (workspace: Workspace): IActions => {
    const workspaceActions = [
      {
        id: 'view-details',
        title: 'View Details',
        onClick: () => viewDetailsClick(workspace),
      },
      // TODO: Uncomment when edit action is fully supported
      // {
      //   id: 'edit',
      //   title: 'Edit',
      //   onClick: () => editAction(workspace),
      // },
      {
        id: 'delete',
        title: 'Delete',
        onClick: () => handleDeleteClick(workspace),
      },
      {
        isSeparator: true,
      },
      workspace.state !== WorkspaceState.WorkspaceStateRunning
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

    if (workspace.state === WorkspaceState.WorkspaceStateRunning) {
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
            onActionDone={() => {
              workspacesRefresh();
            }}
            onStart={async () => {
              if (!selectedWorkspace) {
                return;
              }

              return api.startWorkspace({}, selectedNamespace, selectedWorkspace.name);
            }}
            onUpdateAndStart={async () => {
              // TODO: implement update and stop
            }}
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
            onActionDone={() => {
              workspacesRefresh();
            }}
            onStop={async () => {
              if (!selectedWorkspace) {
                return;
              }
              return api.pauseWorkspace({}, selectedNamespace, selectedWorkspace.name);
            }}
            onUpdateAndStop={async () => {
              // TODO: implement update and stop
            }}
          />
        );
    }
    return undefined;
  };

  const extractStateColor = (state: WorkspaceState) => {
    switch (state) {
      case WorkspaceState.WorkspaceStateRunning:
        return 'green';
      case WorkspaceState.WorkspaceStatePending:
        return 'orange';
      case WorkspaceState.WorkspaceStateTerminating:
        return 'yellow';
      case WorkspaceState.WorkspaceStateError:
        return 'red';
      case WorkspaceState.WorkspaceStatePaused:
        return 'purple';
      case WorkspaceState.WorkspaceStateUnknown:
      default:
        return 'grey';
    }
  };

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
          // TODO: Uncomment when edit action is fully supported
          // onEditClick={() => editAction(selectedWorkspace)}
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
            <Content style={{ display: 'flex', alignItems: 'flex-start', columnGap: '20px' }}>
              <Filter
                ref={filterRef}
                id="filter-workspaces"
                filters={filters}
                setFilters={setFilters}
                columnDefinition={visibleFilterableColumns}
                toolbarActions={
                  canCreateWorkspaces && (
                    <Button variant="primary" ouiaId="Primary" onClick={createWorkspace}>
                      Create Workspace
                    </Button>
                  )
                }
              />
            </Content>
            <Table
              data-testid="workspaces-table"
              aria-label="Sortable table"
              ouiaId="SortableTable"
            >
              <Thead>
                <Tr>
                  {canExpandRows && <Th screenReaderText="expand-action" />}
                  {visibleColumnKeys.map((columnKey, index) => (
                    <Th
                      key={`workspace-table-column-${columnKey}`}
                      sort={columnKey !== 'redirectStatus' ? getSortParams(index) : undefined}
                      aria-label={columnKey}
                    >
                      {wsTableColumns[columnKey].label}
                    </Th>
                  ))}
                </Tr>
              </Thead>
              {sortedWorkspaces.length > 0 &&
                sortedWorkspaces.map((workspace, rowIndex) => (
                  <Tbody
                    id="workspaces-table-content"
                    key={rowIndex}
                    isExpanded={isWorkspaceExpanded(workspace)}
                    data-testid="table-body"
                  >
                    <Tr
                      id={`workspaces-table-row-${rowIndex + 1}`}
                      data-testid={`workspace-row-${rowIndex}`}
                    >
                      {canExpandRows && (
                        <Td
                          expand={{
                            rowIndex,
                            isExpanded: isWorkspaceExpanded(workspace),
                            onToggle: () =>
                              setWorkspaceExpanded(workspace, !isWorkspaceExpanded(workspace)),
                          }}
                        />
                      )}
                      {visibleColumnKeys.map((columnKey) => {
                        switch (columnKey) {
                          case 'redirectStatus':
                            return (
                              <Td key={columnKey} dataLabel={wsTableColumns[columnKey].label}>
                                {workspaceRedirectStatus[workspace.workspaceKind.name]
                                  ? getRedirectStatusIcon(
                                      workspaceRedirectStatus[workspace.workspaceKind.name]?.message
                                        ?.level,
                                      workspaceRedirectStatus[workspace.workspaceKind.name]?.message
                                        ?.text || 'No API response available',
                                    )
                                  : getRedirectStatusIcon(undefined, 'No API response available')}
                              </Td>
                            );
                          case 'name':
                            return (
                              <Td
                                key={columnKey}
                                data-testid="workspace-name"
                                dataLabel={wsTableColumns[columnKey].label}
                              >
                                {workspace.name}
                              </Td>
                            );
                          case 'kind':
                            return (
                              <Td key={columnKey} dataLabel={wsTableColumns[columnKey].label}>
                                {kindLogoDict[workspace.workspaceKind.name] ? (
                                  <Tooltip content={workspace.workspaceKind.name}>
                                    <Brand
                                      src={kindLogoDict[workspace.workspaceKind.name]}
                                      alt={workspace.workspaceKind.name}
                                      style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                                    />
                                  </Tooltip>
                                ) : (
                                  <Tooltip content={workspace.workspaceKind.name}>
                                    <CodeIcon />
                                  </Tooltip>
                                )}
                              </Td>
                            );
                          case 'image':
                            return (
                              <Td key={columnKey} dataLabel={wsTableColumns[columnKey].label}>
                                {workspace.podTemplate.options.imageConfig.current.displayName}
                              </Td>
                            );
                          case 'podConfig':
                            return (
                              <Td
                                key={columnKey}
                                data-testid="pod-config"
                                dataLabel={wsTableColumns[columnKey].label}
                              >
                                {workspace.podTemplate.options.podConfig.current.displayName}
                              </Td>
                            );
                          case 'state':
                            return (
                              <Td
                                key={columnKey}
                                data-testid="state-label"
                                dataLabel={wsTableColumns[columnKey].label}
                              >
                                <Label color={extractStateColor(workspace.state)}>
                                  {workspace.state}
                                </Label>
                              </Td>
                            );
                          case 'homeVol':
                            return (
                              <Td key={columnKey} dataLabel={wsTableColumns[columnKey].label}>
                                {workspace.podTemplate.volumes.home?.pvcName ?? ''}
                              </Td>
                            );
                          case 'cpu':
                            return (
                              <Td key={columnKey} dataLabel={wsTableColumns[columnKey].label}>
                                {formatResourceFromWorkspace(workspace, 'cpu')}
                              </Td>
                            );
                          case 'ram':
                            return (
                              <Td key={columnKey} dataLabel={wsTableColumns[columnKey].label}>
                                {formatResourceFromWorkspace(workspace, 'memory')}
                              </Td>
                            );
                          case 'lastActivity':
                            return (
                              <Td key={columnKey} dataLabel={wsTableColumns[columnKey].label}>
                                <Timestamp
                                  date={new Date(workspace.activity.lastActivity)}
                                  tooltip={{ variant: TimestampTooltipVariant.default }}
                                >
                                  {formatDistanceToNow(new Date(workspace.activity.lastActivity), {
                                    addSuffix: true,
                                  })}
                                </Timestamp>
                              </Td>
                            );
                          case 'connect':
                            return (
                              <Td key={columnKey}>
                                <WorkspaceConnectAction workspace={workspace} />
                              </Td>
                            );
                          case 'actions':
                            return (
                              <Td key={columnKey} isActionCell data-testid="action-column">
                                <ActionsColumn
                                  items={workspaceDefaultActions(workspace).map((action) => ({
                                    ...action,
                                    'data-testid': `action-${action.id || ''}`,
                                  }))}
                                />
                              </Td>
                            );
                          default:
                            return null;
                        }
                      })}
                    </Tr>
                    {isWorkspaceExpanded(workspace) && (
                      <ExpandedWorkspaceRow
                        workspace={workspace}
                        columnKeys={wsTableColumnKeyArray}
                      />
                    )}
                  </Tbody>
                ))}
              {sortedWorkspaces.length === 0 && (
                <Tbody>
                  <Tr>
                    <Td colSpan={12} id="empty-state-cell">
                      <Bullseye>
                        <CustomEmptyState onClearFilters={() => filterRef.current?.clearAll()} />
                      </Bullseye>
                    </Td>
                  </Tr>
                </Tbody>
              )}
            </Table>
            {isActionAlertModalOpen && chooseAlertModal()}
            {selectedWorkspace && (
              <DeleteModal
                isOpen={activeActionType === ActionType.Delete}
                resourceName={selectedWorkspace.name}
                namespace={selectedWorkspace.namespace}
                title="Delete Workspace?"
                onClose={() => {
                  setSelectedWorkspace(null);
                  setActiveActionType(null);
                }}
                onDelete={() => deleteAction()}
              />
            )}
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

export default WorkspaceTable;
