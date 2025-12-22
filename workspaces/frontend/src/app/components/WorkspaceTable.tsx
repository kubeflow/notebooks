import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
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
import { ToolbarItem } from '@patternfly/react-core/dist/esm/components/Toolbar';
import {
  Table,
  TableText,
  Thead,
  Tr,
  Th,
  Tbody,
  Td,
  ThProps,
  ActionsColumn,
  IActions,
} from '@patternfly/react-table/dist/esm/components/Table';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { InfoCircleIcon } from '@patternfly/react-icons/dist/esm/icons/info-circle-icon';
import { ExclamationTriangleIcon } from '@patternfly/react-icons/dist/esm/icons/exclamation-triangle-icon';
import { TimesCircleIcon } from '@patternfly/react-icons/dist/esm/icons/times-circle-icon';
import { QuestionCircleIcon } from '@patternfly/react-icons/dist/esm/icons/question-circle-icon';
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow';
import { DataFieldKey, defineDataFields, SortableDataFieldKey } from '~/app/filterableDataHelper';
import { useTypedNavigate } from '~/app/routerHelper';
import {
  buildKindLogoDictionary,
  buildWorkspaceRedirectStatus,
} from '~/app/actions/WorkspaceKindsActions';
import useWorkspaceKinds from '~/app/hooks/useWorkspaceKinds';
import { WorkspaceConnectAction } from '~/app/pages/Workspaces/WorkspaceConnectAction';
import WithValidImage from '~/shared/components/WithValidImage';
import ImageFallback from '~/shared/components/ImageFallback';
import {
  formatResourceFromWorkspace,
  formatWorkspaceIdleState,
  extractWorkspaceStateColor,
  WORKSPACE_STATE_COLORS,
} from '~/shared/utilities/WorkspaceUtils';
import { ExpandedWorkspaceRow } from '~/app/pages/Workspaces/ExpandedWorkspaceRow';
import CustomEmptyState from '~/shared/components/CustomEmptyState';
import { WorkspacesWorkspaceListItem, WorkspacesWorkspaceState } from '~/generated/data-contracts';
import { useWorkspaceActionsContext } from '~/app/context/WorkspaceActionsContext';
import { POLL_INTERVAL } from '~/shared/utilities/const';
import { RefreshCounter } from '~/app/components/RefreshCounter';
import ToolbarFilter, {
  FilterConfigMap,
  FilterValue,
  ToolbarFilterRef,
} from '~/shared/components/ToolbarFilter';
import { useToolbarFilters, applyFilters } from '~/shared/hooks/useToolbarFilters';

const {
  fields: wsTableColumns,
  keyArray: wsTableColumnKeyArray,
  sortableKeyArray: sortableWsTableColumnKeyArray,
} = defineDataFields({
  name: { label: 'Name', isFilterable: true, isSortable: true, width: 20 },
  image: { label: 'Image', isFilterable: true, isSortable: true, width: 20 },
  kind: { label: 'Kind', isFilterable: true, isSortable: true, width: 10 },
  namespace: { label: 'Namespace', isFilterable: true, isSortable: true, width: 15 },
  state: { label: 'State', isFilterable: true, isSortable: true, width: 10 },
  gpu: { label: 'GPU', isFilterable: true, isSortable: true, width: 15 },
  idleGpu: { label: 'Idle GPU', isFilterable: true, isSortable: true, width: 15 },
  lastActivity: { label: 'Last activity', isFilterable: false, isSortable: true, width: 15 },
  connect: { label: '', isFilterable: false, isSortable: false, width: undefined },
  actions: { label: '', isFilterable: false, isSortable: false, width: undefined },
});

export type WorkspaceTableColumnKeys = DataFieldKey<typeof wsTableColumns>;
type WorkspaceTableSortableColumnKeys = SortableDataFieldKey<typeof wsTableColumns>;

interface WorkspaceTableProps {
  workspaces: WorkspacesWorkspaceListItem[];
  refreshWorkspaces: () => void;
  canCreateWorkspaces?: boolean;
  canExpandRows?: boolean;
  hiddenColumns?: WorkspaceTableColumnKeys[];
  rowActions?: (workspace: WorkspacesWorkspaceListItem) => IActions;
}

const filterConfig = {
  name: { type: 'text', label: 'Name', placeholder: 'Filter by name' },
  kind: { type: 'text', label: 'Kind', placeholder: 'Filter by kind' },
  image: { type: 'text', label: 'Image', placeholder: 'Filter by image' },
  state: {
    type: 'select',
    label: 'State',
    placeholder: 'Filter by state',
    options: (Object.keys(WORKSPACE_STATE_COLORS) as WorkspacesWorkspaceState[])
      .sort((a, b) => a.localeCompare(b))
      .map((state) => ({
        value: state,
        label: state,
      })),
  },
  namespace: { type: 'text', label: 'Namespace', placeholder: 'Filter by namespace' },
  idleGpu: { type: 'text', label: 'Idle GPU', placeholder: 'Filter by idle GPU' },
} as const satisfies FilterConfigMap<string>;

type WorkspaceFilterKey = keyof typeof filterConfig;

// Defines which filters should appear in the dropdown
const visibleFilterKeys: readonly WorkspaceFilterKey[] = ['name', 'kind', 'image', 'state'];

export interface WorkspaceTableRef {
  clearAllFilters: () => void;
  setFilter: (key: WorkspaceFilterKey, value: FilterValue) => void;
}

const WorkspaceTable = React.forwardRef<WorkspaceTableRef, WorkspaceTableProps>(
  (
    {
      workspaces,
      refreshWorkspaces,
      canCreateWorkspaces = true,
      canExpandRows = true,
      hiddenColumns = [],
      rowActions = () => [],
    },
    ref,
  ) => {
    const { isDrawerExpanded } = useWorkspaceActionsContext();
    const [workspaceKinds] = useWorkspaceKinds();
    const [expandedWorkspacesNames, setExpandedWorkspacesNames] = useState<string[]>([]);

    const { filterValues, setFilter, clearAllFilters } =
      useToolbarFilters<WorkspaceFilterKey>(filterConfig);

    const [activeSortColumnKey, setActiveSortColumnKey] =
      useState<WorkspaceTableSortableColumnKeys | null>('lastActivity');
    const [activeSortDirection, setActiveSortDirection] = useState<'asc' | 'desc' | null>('desc');
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(10);

    const navigate = useTypedNavigate();
    const kindLogoDict = buildKindLogoDictionary(workspaceKinds);
    const workspaceRedirectStatus = buildWorkspaceRedirectStatus(workspaceKinds);

    const toolbarFilterRef = useRef<ToolbarFilterRef<WorkspaceFilterKey> | null>(null);

    useImperativeHandle(ref, () => ({
      clearAllFilters,
      setFilter,
    }));

    const createWorkspace = useCallback(() => {
      navigate('workspaceCreate');
    }, [navigate]);

    const emptyState = useMemo(
      () => <CustomEmptyState onClearFilters={clearAllFilters} />,
      [clearAllFilters],
    );

    const filterableProperties: Record<
      WorkspaceFilterKey,
      (ws: WorkspacesWorkspaceListItem) => string
    > = useMemo(
      () => ({
        name: (ws) => ws.name,
        kind: (ws) => ws.workspaceKind.name,
        image: (ws) => ws.podTemplate.options.imageConfig.current.displayName,
        state: (ws) => ws.state,
        namespace: (ws) => ws.namespace,
        idleGpu: (ws) => formatWorkspaceIdleState(ws),
      }),
      [],
    );

    const setWorkspaceExpanded = (workspace: WorkspacesWorkspaceListItem, isExpanding = true) =>
      setExpandedWorkspacesNames((prevExpanded) => {
        const newExpandedWorkspacesNames = prevExpanded.filter(
          (wsName) => wsName !== workspace.name,
        );
        return isExpanding
          ? [...newExpandedWorkspacesNames, workspace.name]
          : newExpandedWorkspacesNames;
      });

    const isWorkspaceExpanded = (workspace: WorkspacesWorkspaceListItem) =>
      expandedWorkspacesNames.includes(workspace.name);

    const filteredWorkspaces = useMemo(
      () => applyFilters(workspaces, filterValues, filterableProperties),
      [workspaces, filterValues, filterableProperties],
    );

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

    // Column sorting
    const getSortableRowValues = (
      workspace: WorkspacesWorkspaceListItem,
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

    useEffect(() => {
      const totalPages = Math.max(1, Math.ceil(sortedWorkspaces.length / perPage) || 1);
      if (page > totalPages) {
        setPage(totalPages);
      }
    }, [sortedWorkspaces.length, perPage, page]);

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

    // Toolbar actions
    const toolbarActions = canCreateWorkspaces ? (
      <ToolbarItem>
        <Button variant="primary" ouiaId="Primary" onClick={createWorkspace}>
          Create workspace
        </Button>
      </ToolbarItem>
    ) : undefined;

    return (
      <>
        <Content style={{ display: 'flex', alignItems: 'flex-start', columnGap: '20px' }}>
          <ToolbarFilter
            ref={toolbarFilterRef}
            filterConfig={filterConfig}
            visibleFilterKeys={visibleFilterKeys}
            filterValues={filterValues}
            onFilterChange={setFilter}
            onClearAllFilters={clearAllFilters}
            toolbarActions={toolbarActions}
            testIdPrefix="filter-workspaces"
          />
        </Content>
        <Table
          data-testid="workspaces-table"
          aria-label="Sortable table"
          ouiaId="SortableTable"
          variant="compact"
          gridBreakPoint={isDrawerExpanded ? 'grid' : 'grid-lg'}
        >
          <Thead>
            <Tr>
              {canExpandRows && <Th width={10} screenReaderText="expand-action" />}
              {visibleColumnKeys.map((columnKey) => {
                const specialProps = getSpecialColumnProps(columnKey);
                const modifier = getColumnModifier(columnKey);

                return (
                  <Th
                    key={`workspace-table-column-${columnKey}`}
                    width={wsTableColumns[columnKey].width}
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
            sortedWorkspaces
              .slice(perPage * (page - 1), perPage * page)
              .map((workspace, rowIndex) => (
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
                          <Td
                            dataLabel={wsTableColumns[columnKey].label}
                            modifier="fitContent"
                            hasAction
                            key="connect"
                          >
                            <TableText>
                              <WorkspaceConnectAction workspace={workspace} />
                            </TableText>
                          </Td>
                        );
                      }

                      if (columnKey === 'actions') {
                        return (
                          <Td isActionCell key="actions" data-testid="action-column">
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
                              <span data-testid="workspace-image-name">
                                {workspace.podTemplate.options.imageConfig.current.displayName}
                              </span>{' '}
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
                            <div className="pf-v6-u-display-inline-block">
                              <Label color={extractWorkspaceStateColor(workspace.state)}>
                                {workspace.state}
                              </Label>
                            </div>
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
            <Tr>
              <Td colSpan={8} id="empty-state-cell">
                <Bullseye>{emptyState}</Bullseye>
              </Td>
            </Tr>
          )}
        </Table>
        <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }}>
          <FlexItem>
            <RefreshCounter interval={POLL_INTERVAL} onRefresh={refreshWorkspaces} />
          </FlexItem>
          <FlexItem>
            <Pagination
              itemCount={sortedWorkspaces.length}
              widgetId="bottom-example"
              perPage={perPage}
              page={page}
              variant={PaginationVariant.bottom}
              isCompact
              onSetPage={onSetPage}
              onPerPageSelect={onPerPageSelect}
            />
          </FlexItem>
        </Flex>
      </>
    );
  },
);

WorkspaceTable.displayName = 'WorkspaceTable';

export default WorkspaceTable;
