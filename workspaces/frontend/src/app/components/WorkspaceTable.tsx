import React, { useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
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
  Icon,
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
  ExpandableRowContent,
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
import {
  DataFieldKey,
  defineDataFields,
  FilterableDataFieldKey,
  SortableDataFieldKey,
} from '~/app/filterableDataHelper';
import { useTypedNavigate } from '~/app/routerHelper';
import {
  buildKindLogoDictionary,
  buildWorkspaceRedirectStatus,
} from '~/app/actions/WorkspaceKindsActions';
import useWorkspaceKinds from '~/app/hooks/useWorkspaceKinds';
import { WorkspaceConnectAction } from '~/app/pages/Workspaces/WorkspaceConnectAction';
import CustomEmptyState from '~/shared/components/CustomEmptyState';
import Filter, { FilteredColumn, FilterRef } from '~/shared/components/Filter';
import {
  formatResourceFromWorkspace,
  formatWorkspaceIdleState,
} from '~/shared/utilities/WorkspaceUtils';
import { WorkspaceConfigDetails } from '~/app/pages/Workspaces/WorkspaceConfigDetails';
import { WorkspaceStorage } from '~/app/pages/Workspaces/WorkspaceStorage';
import { WorkspacePackageDetails } from '~/app/pages/Workspaces/WorkspacePackageDetails';

const {
  fields: wsTableColumns,
  keyArray: wsTableColumnKeyArray,
  sortableKeyArray: sortableWsTableColumnKeyArray,
  filterableKeyArray: filterableWsTableColumnKeyArray,
} = defineDataFields({
  name: { label: 'Name', isFilterable: true, isSortable: true },
  kind: { label: 'Kind', isFilterable: true, isSortable: true },
  namespace: { label: 'Namespace', isFilterable: true, isSortable: true },
  image: { label: 'Image', isFilterable: true, isSortable: true },
  state: { label: 'State', isFilterable: true, isSortable: true },
  homeVol: { label: 'Home Vol', isFilterable: true, isSortable: true },
  gpu: { label: 'GPU', isFilterable: true, isSortable: true },
  idleGpu: { label: 'Idle GPU', isFilterable: true, isSortable: true },
  lastActivity: { label: 'Last activity', isFilterable: false, isSortable: true },
  connect: { label: '', isFilterable: false, isSortable: false },
  actions: { label: '', isFilterable: false, isSortable: false },
});

export type WorkspaceTableColumnKeys = DataFieldKey<typeof wsTableColumns>;
type WorkspaceTableFilterableColumnKeys = FilterableDataFieldKey<typeof wsTableColumns>;
type WorkspaceTableSortableColumnKeys = SortableDataFieldKey<typeof wsTableColumns>;
export type WorkspaceTableFilteredColumn = FilteredColumn<WorkspaceTableFilterableColumnKeys>;

interface WorkspaceTableProps {
  workspaces: Workspace[];
  canCreateWorkspaces?: boolean;
  canExpandRows?: boolean;
  initialFilters?: WorkspaceTableFilteredColumn[];
  hiddenColumns?: WorkspaceTableColumnKeys[];
  rowActions?: (workspace: Workspace) => IActions;
}

export interface WorkspaceTableRef {
  addFilter: (filter: WorkspaceTableFilteredColumn) => void;
}

const WorkspaceTable = React.forwardRef<WorkspaceTableRef, WorkspaceTableProps>(
  (
    {
      workspaces,
      canCreateWorkspaces = true,
      canExpandRows = true,
      initialFilters = [],
      hiddenColumns = [],
      rowActions = () => [],
    },
    ref,
  ) => {
    const [workspaceKinds] = useWorkspaceKinds();
    const [expandedWorkspacesNames, setExpandedWorkspacesNames] = useState<string[]>([]);
    const [filters, setFilters] = useState<FilteredColumn[]>(initialFilters);
    const [activeSortColumnKey, setActiveSortColumnKey] =
      useState<WorkspaceTableSortableColumnKeys | null>(null);
    const [activeSortDirection, setActiveSortDirection] = useState<'asc' | 'desc' | null>(null);
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(10);

    const navigate = useTypedNavigate();
    const filterRef = useRef<FilterRef>(null);
    const kindLogoDict = buildKindLogoDictionary(workspaceKinds);
    const workspaceRedirectStatus = buildWorkspaceRedirectStatus(workspaceKinds);

    const visibleColumnKeys: WorkspaceTableColumnKeys[] = useMemo(
      () =>
        hiddenColumns.length
          ? wsTableColumnKeyArray.filter((col) => !hiddenColumns.includes(col))
          : wsTableColumnKeyArray,
      [hiddenColumns],
    );

    const visibleSortableColumnKeys: WorkspaceTableSortableColumnKeys[] = useMemo(
      () => sortableWsTableColumnKeyArray.filter((col) => visibleColumnKeys.includes(col)),
      [visibleColumnKeys],
    );

    const visibleFilterableColumnKeys: WorkspaceTableFilterableColumnKeys[] = useMemo(
      () => filterableWsTableColumnKeyArray.filter((col) => visibleColumnKeys.includes(col)),
      [visibleColumnKeys],
    );

    const visibleFilterableColumnMap = useMemo(
      () =>
        Object.fromEntries(
          visibleFilterableColumnKeys.map((key) => [key, wsTableColumns[key].label]),
        ) as Record<WorkspaceTableFilterableColumnKeys, string>,
      [visibleFilterableColumnKeys],
    );

    useImperativeHandle(ref, () => ({
      addFilter: (newFilter: WorkspaceTableFilteredColumn) => {
        if (!visibleFilterableColumnKeys.includes(newFilter.columnKey)) {
          return;
        }

        setFilters((prev) => {
          const existingIndex = prev.findIndex((f) => f.columnKey === newFilter.columnKey);
          if (existingIndex !== -1) {
            return prev.map((f, i) => (i === existingIndex ? newFilter : f));
          }
          return [...prev, newFilter];
        });
      },
    }));

    const createWorkspace = useCallback(() => {
      navigate('workspaceCreate');
    }, [navigate]);

    const setWorkspaceExpanded = (workspace: Workspace, isExpanding = true) =>
      setExpandedWorkspacesNames((prevExpanded) => {
        const newExpandedWorkspacesNames = prevExpanded.filter(
          (wsName) => wsName !== workspace.name,
        );
        return isExpanding
          ? [...newExpandedWorkspacesNames, workspace.name]
          : newExpandedWorkspacesNames;
      });

    const isWorkspaceExpanded = (workspace: Workspace) =>
      expandedWorkspacesNames.includes(workspace.name);

    const filteredWorkspaces = useMemo(() => {
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
            case 'namespace':
              return ws.namespace.match(searchValueInput);
            case 'image':
              return ws.podTemplate.options.imageConfig.current.displayName.match(searchValueInput);
            case 'state':
              return ws.state.match(searchValueInput);
            case 'gpu':
              return formatResourceFromWorkspace(ws, 'gpu').match(searchValueInput);
            case 'idleGpu':
              return formatWorkspaceIdleState(ws).match(searchValueInput);
            default:
              return true;
          }
        });
      }, workspaces);
    }, [workspaces, filters]);

    // Column sorting

    const getSortableRowValues = (
      workspace: Workspace,
    ): Record<WorkspaceTableSortableColumnKeys, string | number> => ({
      name: workspace.name,
      kind: workspace.workspaceKind.name,
      namespace: workspace.namespace,
      image: workspace.podTemplate.options.imageConfig.current.displayName,
      state: workspace.state,
      homeVol: workspace.podTemplate.volumes.home?.pvcName ?? '',
      gpu: formatResourceFromWorkspace(workspace, 'gpu'),
      idleGpu: formatWorkspaceIdleState(workspace),
      lastActivity: workspace.activity.lastActivity,
    });

    const sortedWorkspaces = useMemo(() => {
      if (activeSortColumnKey === null) {
        return filteredWorkspaces;
      }

      return [...filteredWorkspaces].sort((a, b) => {
        const aValue = getSortableRowValues(a)[activeSortColumnKey];
        const bValue = getSortableRowValues(b)[activeSortColumnKey];

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          // Numeric sort
          return activeSortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        }
        // String sort
        return activeSortDirection === 'asc'
          ? String(aValue).localeCompare(String(bValue))
          : String(bValue).localeCompare(String(aValue));
      });
    }, [filteredWorkspaces, activeSortColumnKey, activeSortDirection]);

    const getSortParams = (columnKey: WorkspaceTableColumnKeys): ThProps['sort'] => {
      const sortableColumnKey = columnKey as WorkspaceTableSortableColumnKeys;
      if (!visibleSortableColumnKeys.includes(sortableColumnKey)) {
        return undefined;
      }
      const activeSortColumnIndex = activeSortColumnKey
        ? visibleSortableColumnKeys.indexOf(activeSortColumnKey)
        : undefined;
      return {
        sortBy: {
          index: activeSortColumnIndex,
          direction: activeSortDirection || 'asc',
          defaultDirection: 'asc', // starting sort direction when first sorting a column. Defaults to 'asc'
        },
        onSort: (_event, _index, direction) => {
          setActiveSortColumnKey(sortableColumnKey);
          setActiveSortDirection(direction);
        },
        columnIndex: visibleSortableColumnKeys.indexOf(sortableColumnKey),
      };
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
              <Icon status="info" isInline>
                <InfoCircleIcon aria-hidden="true" />
              </Icon>
            </Tooltip>
          );
        case 'Warning':
          return (
            <Tooltip content={message}>
              <Icon isInline>
                <ExclamationTriangleIcon color="orange" aria-hidden="true" />
              </Icon>
            </Tooltip>
          );
        case 'Danger':
          return (
            <Tooltip content={message}>
              <Icon isInline>
                <TimesCircleIcon color="red" aria-hidden="true" />
              </Icon>
            </Tooltip>
          );
        case undefined:
          return (
            <Tooltip content={message}>
              <Icon isInline>
                <QuestionCircleIcon color="gray" aria-hidden="true" />
              </Icon>
            </Tooltip>
          );
        default:
          return (
            <Tooltip content={`Invalid level: ${level}`}>
              <Icon isInline>
                <QuestionCircleIcon color="gray" aria-hidden="true" />
              </Icon>
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

    return (
      <PageSection isFilled>
        <Content style={{ display: 'flex', alignItems: 'flex-start', columnGap: '20px' }}>
          <Filter
            ref={filterRef}
            id="filter-workspaces"
            filters={filters}
            setFilters={setFilters}
            columnDefinition={visibleFilterableColumnMap}
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
          style={{ tableLayout: 'fixed' }}
        >
          <Thead>
            <Tr>
              {canExpandRows && <Th width={10} screenReaderText="expand-action" />}
              {visibleColumnKeys.includes('name') && (
                <Th
                  width={25}
                  key="workspace-table-column-name"
                  sort={getSortParams('name')}
                  aria-label="name"
                  modifier="wrap"
                >
                  {wsTableColumns.name.label}
                </Th>
              )}
              {visibleColumnKeys.includes('image') && (
                <Th
                  width={25}
                  key="workspace-table-column-image"
                  sort={getSortParams('image')}
                  aria-label="image"
                  modifier="wrap"
                >
                  {wsTableColumns.image.label}
                </Th>
              )}
              {visibleColumnKeys.includes('kind') && (
                <Th
                  width={20}
                  key="workspace-table-column-kind"
                  sort={getSortParams('kind')}
                  aria-label="kind"
                  modifier="wrap"
                >
                  {wsTableColumns.kind.label}
                </Th>
              )}
              {visibleColumnKeys.includes('namespace') && (
                <Th
                  width={15}
                  key="workspace-table-column-namespace"
                  sort={getSortParams('namespace')}
                  aria-label="namespace"
                  modifier="wrap"
                >
                  {wsTableColumns.namespace.label}
                </Th>
              )}
              {visibleColumnKeys.includes('state') && (
                <Th
                  width={15}
                  key="workspace-table-column-state"
                  sort={getSortParams('state')}
                  aria-label="state"
                  modifier="wrap"
                >
                  {wsTableColumns.state.label}
                </Th>
              )}
              {visibleColumnKeys.includes('gpu') && (
                <Th
                  width={15}
                  key="workspace-table-column-gpu"
                  sort={getSortParams('gpu')}
                  aria-label="gpu"
                  modifier="wrap"
                >
                  {wsTableColumns.gpu.label}
                </Th>
              )}
              {visibleColumnKeys.includes('idleGpu') && (
                <Th
                  width={15}
                  key="workspace-table-column-idleGpu"
                  sort={getSortParams('idleGpu')}
                  aria-label="idleGpu"
                  modifier="wrap"
                >
                  {wsTableColumns.idleGpu.label}
                </Th>
              )}
              {visibleColumnKeys.includes('lastActivity') && (
                <Th
                  width={15}
                  key="workspace-table-column-lastActivity"
                  sort={getSortParams('lastActivity')}
                  aria-label="lastActivity"
                  modifier="wrap"
                >
                  {wsTableColumns.lastActivity.label}
                </Th>
              )}
              {visibleColumnKeys.includes('connect') && (
                <Th width={25} screenReaderText="Connect action" />
              )}
              {visibleColumnKeys.includes('actions') && (
                <Th width={10} screenReaderText="Primary action" />
              )}
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
                  isStriped={rowIndex % 2 === 0}
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
                  {visibleColumnKeys.includes('name') && (
                    <Td
                      key="name"
                      data-testid="workspace-name"
                      dataLabel={wsTableColumns.name.label}
                    >
                      {workspace.name}
                    </Td>
                  )}
                  {visibleColumnKeys.includes('image') && (
                    <Td key="image" dataLabel={wsTableColumns.image.label}>
                      <Content>
                        {workspace.podTemplate.options.imageConfig.current.displayName}{' '}
                        {workspaceRedirectStatus[workspace.workspaceKind.name]
                          ? getRedirectStatusIcon(
                              workspaceRedirectStatus[workspace.workspaceKind.name]?.message?.level,
                              workspaceRedirectStatus[workspace.workspaceKind.name]?.message
                                ?.text || 'No API response available',
                            )
                          : getRedirectStatusIcon(undefined, 'No API response available')}
                      </Content>
                    </Td>
                  )}
                  {visibleColumnKeys.includes('kind') && (
                    <Td key="kind" dataLabel={wsTableColumns.kind.label}>
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
                  )}
                  {visibleColumnKeys.includes('namespace') && (
                    <Td key="namespace" dataLabel={wsTableColumns.namespace.label}>
                      {workspace.namespace}
                    </Td>
                  )}
                  {visibleColumnKeys.includes('state') && (
                    <Td
                      key="state"
                      data-testid="state-label"
                      dataLabel={wsTableColumns.state.label}
                    >
                      <Label color={extractStateColor(workspace.state)}>{workspace.state}</Label>
                    </Td>
                  )}
                  {visibleColumnKeys.includes('gpu') && (
                    <Td key="gpu" dataLabel={wsTableColumns.gpu.label}>
                      {formatResourceFromWorkspace(workspace, 'gpu')}
                    </Td>
                  )}
                  {visibleColumnKeys.includes('idleGpu') && (
                    <Td key="idleGpu" dataLabel={wsTableColumns.idleGpu.label}>
                      {formatWorkspaceIdleState(workspace)}
                    </Td>
                  )}
                  {visibleColumnKeys.includes('lastActivity') && (
                    <Td key="lastActivity" dataLabel={wsTableColumns.lastActivity.label}>
                      <Timestamp
                        date={new Date(workspace.activity.lastActivity)}
                        tooltip={{ variant: TimestampTooltipVariant.default }}
                      >
                        {formatDistanceToNow(new Date(workspace.activity.lastActivity), {
                          addSuffix: true,
                        })}
                      </Timestamp>
                    </Td>
                  )}
                  {visibleColumnKeys.includes('connect') && (
                    <Td key="connect" isActionCell>
                      <WorkspaceConnectAction workspace={workspace} />
                    </Td>
                  )}
                  {visibleColumnKeys.includes('actions') && (
                    <Td key="actions" isActionCell data-testid="action-column">
                      <ActionsColumn
                        items={rowActions(workspace).map((action) => ({
                          ...action,
                          'data-testid': `action-${action.id || ''}`,
                        }))}
                      />
                    </Td>
                  )}
                </Tr>
                {isWorkspaceExpanded(workspace) && (
                  <Tr isExpanded>
                    <Td />
                    <Td dataLabel="Storage">
                      <ExpandableRowContent>
                        <WorkspaceStorage workspace={workspace} />
                      </ExpandableRowContent>
                    </Td>
                    <Td>
                      <ExpandableRowContent>
                        <WorkspacePackageDetails workspace={workspace} />
                      </ExpandableRowContent>
                    </Td>
                    <Td>
                      <ExpandableRowContent>
                        <WorkspaceConfigDetails workspace={workspace} />
                      </ExpandableRowContent>
                    </Td>
                    <Td />
                    <Td />
                    <Td />
                    <Td />
                  </Tr>
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
    );
  },
);

WorkspaceTable.displayName = 'WorkspaceTable';

export default WorkspaceTable;
