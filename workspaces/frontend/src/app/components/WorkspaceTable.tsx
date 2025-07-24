import React, { useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { PageSection } from '@patternfly/react-core/dist/esm/components/Page';
import {
  TimestampTooltipVariant,
  Timestamp,
} from '@patternfly/react-core/dist/esm/components/Timestamp';
import { Label } from '@patternfly/react-core/dist/esm/components/Label';
import {
  PaginationVariant,
  Pagination,
} from '@patternfly/react-core/dist/esm/components/Pagination';
import { Content } from '@patternfly/react-core/dist/esm/components/Content';
import { Tooltip } from '@patternfly/react-core/dist/esm/components/Tooltip';
import { Bullseye } from '@patternfly/react-core/dist/esm/layouts/Bullseye';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { Icon } from '@patternfly/react-core/dist/esm/components/Icon';
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
} from '@patternfly/react-table/dist/esm/components/Table';
import { InfoCircleIcon } from '@patternfly/react-icons/dist/esm/icons/info-circle-icon';
import { ExclamationTriangleIcon } from '@patternfly/react-icons/dist/esm/icons/exclamation-triangle-icon';
import { TimesCircleIcon } from '@patternfly/react-icons/dist/esm/icons/times-circle-icon';
import { QuestionCircleIcon } from '@patternfly/react-icons/dist/esm/icons/question-circle-icon';
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow';
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
import WithValidImage from '~/shared/components/WithValidImage';
import ImageFallback from '~/shared/components/ImageFallback';
import {
  formatResourceFromWorkspace,
  formatWorkspaceIdleState,
} from '~/shared/utilities/WorkspaceUtils';
import { ExpandedWorkspaceRow } from '~/app/pages/Workspaces/ExpandedWorkspaceRow';

const {
  fields: wsTableColumns,
  keyArray: wsTableColumnKeyArray,
  sortableKeyArray: sortableWsTableColumnKeyArray,
  filterableKeyArray: filterableWsTableColumnKeyArray,
} = defineDataFields({
  name: { label: 'Name', isFilterable: true, isSortable: true, width: 35 },
  image: { label: 'Image', isFilterable: true, isSortable: true, width: 25 },
  kind: { label: 'Kind', isFilterable: true, isSortable: true, width: 15 },
  namespace: { label: 'Namespace', isFilterable: true, isSortable: true, width: 15 },
  state: { label: 'State', isFilterable: true, isSortable: true, width: 15 },
  gpu: { label: 'GPU', isFilterable: true, isSortable: true, width: 15 },
  idleGpu: { label: 'Idle GPU', isFilterable: true, isSortable: true, width: 15 },
  lastActivity: { label: 'Last activity', isFilterable: false, isSortable: true, width: 15 },
  connect: { label: '', isFilterable: false, isSortable: false, width: 25 },
  actions: { label: '', isFilterable: false, isSortable: false, width: 10 },
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

    // Column-specific modifiers and special properties
    const getColumnModifier = (
      columnKey: WorkspaceTableColumnKeys,
    ): 'wrap' | 'nowrap' | undefined => {
      switch (columnKey) {
        case 'name':
        case 'kind':
          return 'nowrap';
        case 'image':
        case 'namespace':
        case 'state':
        case 'gpu':
          return 'wrap';
        case 'lastActivity':
          return 'nowrap';
        default:
          return undefined;
      }
    };

    const getSpecialColumnProps = (columnKey: WorkspaceTableColumnKeys) => {
      switch (columnKey) {
        case 'connect':
          return { screenReaderText: 'Connect action', hasContent: false };
        case 'actions':
          return { screenReaderText: 'Primary action', hasContent: false };
        default:
          return { hasContent: true };
      }
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
                  Create workspace
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
              {visibleColumnKeys.map((columnKey) => {
                const specialProps = getSpecialColumnProps(columnKey);
                const modifier = getColumnModifier(columnKey);

                return (
                  <Th
                    width={wsTableColumns[columnKey].width}
                    key={`workspace-table-column-${columnKey}`}
                    sort={specialProps.hasContent ? getSortParams(columnKey) : undefined}
                    aria-label={specialProps.hasContent ? columnKey : undefined}
                    modifier={modifier}
                    screenReaderText={specialProps.screenReaderText}
                  >
                    {specialProps.hasContent ? wsTableColumns[columnKey].label : undefined}
                  </Th>
                );
              })}
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
                  {visibleColumnKeys.map((columnKey) => {
                    if (columnKey === 'connect') {
                      return (
                        <Td key="connect" isActionCell>
                          <WorkspaceConnectAction workspace={workspace} />
                        </Td>
                      );
                    }

                    if (columnKey === 'actions') {
                      return (
                        <Td key="actions" isActionCell data-testid="action-column">
                          <ActionsColumn
                            items={rowActions(workspace).map((action) => ({
                              ...action,
                              'data-testid': `action-${action.id || ''}`,
                            }))}
                          />
                        </Td>
                      );
                    }

                    return (
                      <Td
                        key={columnKey}
                        data-testid={
                          columnKey === 'name'
                            ? 'workspace-name'
                            : columnKey === 'state'
                              ? 'state-label'
                              : `workspace-${columnKey}`
                        }
                        dataLabel={wsTableColumns[columnKey].label}
                      >
                        {columnKey === 'name' && workspace.name}
                        {columnKey === 'image' && (
                          <Content>
                            {workspace.podTemplate.options.imageConfig.current.displayName}{' '}
                            {workspaceRedirectStatus[workspace.workspaceKind.name]
                              ? getRedirectStatusIcon(
                                  workspaceRedirectStatus[workspace.workspaceKind.name]?.message
                                    ?.level,
                                  workspaceRedirectStatus[workspace.workspaceKind.name]?.message
                                    ?.text || 'No API response available',
                                )
                              : getRedirectStatusIcon(undefined, 'No API response available')}
                          </Content>
                        )}
                        {columnKey === 'kind' && (
                          <WithValidImage
                            imageSrc={kindLogoDict[workspace.workspaceKind.name]}
                            skeletonWidth="20px"
                            fallback={
                              <ImageFallback
                                imageSrc={kindLogoDict[workspace.workspaceKind.name]}
                              />
                            }
                          >
                            {(validSrc) => (
                              <Tooltip content={workspace.workspaceKind.name}>
                                <img
                                  src={validSrc}
                                  alt={workspace.workspaceKind.name}
                                  style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                                />
                              </Tooltip>
                            )}
                          </WithValidImage>
                        )}
                        {columnKey === 'namespace' && workspace.namespace}
                        {columnKey === 'state' && (
                          <Label color={extractStateColor(workspace.state)}>
                            {workspace.state}
                          </Label>
                        )}
                        {columnKey === 'gpu' && formatResourceFromWorkspace(workspace, 'gpu')}
                        {columnKey === 'idleGpu' && formatWorkspaceIdleState(workspace)}
                        {columnKey === 'lastActivity' && (
                          <Timestamp
                            date={new Date(workspace.activity.lastActivity)}
                            tooltip={{ variant: TimestampTooltipVariant.default }}
                          >
                            {formatDistanceToNow(new Date(workspace.activity.lastActivity), {
                              addSuffix: true,
                            })}
                          </Timestamp>
                        )}
                      </Td>
                    );
                  })}
                </Tr>
                {isWorkspaceExpanded(workspace) && (
                  <ExpandedWorkspaceRow
                    workspace={workspace}
                    visibleColumnKeys={visibleColumnKeys}
                    canExpandRows={canExpandRows}
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
