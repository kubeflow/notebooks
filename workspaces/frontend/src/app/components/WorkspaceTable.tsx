import React, { useCallback, useImperativeHandle, useMemo, useState } from 'react';
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
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  ToolbarGroup,
  ToolbarFilter,
  ToolbarToggleGroup,
} from '@patternfly/react-core/dist/esm/components/Toolbar';
import {
  Select,
  SelectList,
  SelectOption,
} from '@patternfly/react-core/dist/esm/components/Select';
import { MenuToggle } from '@patternfly/react-core/dist/esm/components/MenuToggle';
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
import { FilterIcon } from '@patternfly/react-icons/dist/esm/icons/filter-icon';
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
import ThemeAwareSearchInput from '~/app/components/ThemeAwareSearchInput';
import WithValidImage from '~/shared/components/WithValidImage';
import ImageFallback from '~/shared/components/ImageFallback';
import {
  formatResourceFromWorkspace,
  formatWorkspaceIdleState,
} from '~/shared/utilities/WorkspaceUtils';
import { ExpandedWorkspaceRow } from '~/app/pages/Workspaces/ExpandedWorkspaceRow';
import CustomEmptyState from '~/shared/components/CustomEmptyState';
import { WorkspacesWorkspace, WorkspacesWorkspaceState } from '~/generated/data-contracts';

const {
  fields: wsTableColumns,
  keyArray: wsTableColumnKeyArray,
  sortableKeyArray: sortableWsTableColumnKeyArray,
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
type WorkspaceTableSortableColumnKeys = SortableDataFieldKey<typeof wsTableColumns>;

interface WorkspaceTableProps {
  workspaces: WorkspacesWorkspace[];
  canCreateWorkspaces?: boolean;
  canExpandRows?: boolean;
  hiddenColumns?: WorkspaceTableColumnKeys[];
  rowActions?: (workspace: WorkspacesWorkspace) => IActions;
}

const allFiltersConfig = {
  name: { label: 'Name', placeholder: 'Filter by name' },
  kind: { label: 'Kind', placeholder: 'Filter by kind' },
  image: { label: 'Image', placeholder: 'Filter by image' },
  state: { label: 'State', placeholder: 'Filter by state' },
  namespace: { label: 'Namespace' },
  idleGpu: { label: 'Idle GPU' },
} as const;

// Defines which of the above filters should appear in the dropdown
const dropdownFilterKeys = ['name', 'kind', 'image', 'state'] as const;

const filterConfigs = dropdownFilterKeys.map((key) => ({
  key,
  label: allFiltersConfig[key].label,
  placeholder: allFiltersConfig[key].placeholder!, // '!' asserts placeholder is not undefined here
}));

type FilterKey = keyof typeof allFiltersConfig;
type FilterLabel = (typeof allFiltersConfig)[FilterKey]['label'];

export interface WorkspaceTableRef {
  clearAllFilters: () => void;
  setFilter: (key: FilterKey, value: string) => void;
}

const WorkspaceTable = React.forwardRef<WorkspaceTableRef, WorkspaceTableProps>(
  (
    {
      workspaces,
      canCreateWorkspaces = true,
      canExpandRows = true,
      hiddenColumns = [],
      rowActions = () => [],
    },
    ref,
  ) => {
    const [workspaceKinds] = useWorkspaceKinds();
    const [expandedWorkspacesNames, setExpandedWorkspacesNames] = useState<string[]>([]);
    const [filters, setFilters] = useState<Record<FilterKey, string>>({
      name: '',
      kind: '',
      image: '',
      state: '',
      namespace: '',
      idleGpu: '',
    });

    const [activeSortColumnKey, setActiveSortColumnKey] =
      useState<WorkspaceTableSortableColumnKeys | null>(null);
    const [activeSortDirection, setActiveSortDirection] = useState<'asc' | 'desc' | null>(null);
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(10);

    const navigate = useTypedNavigate();
    const kindLogoDict = buildKindLogoDictionary(workspaceKinds);
    const workspaceRedirectStatus = buildWorkspaceRedirectStatus(workspaceKinds);

    // Use the derived FilterLabel type for the active menu
    const [activeAttributeMenu, setActiveAttributeMenu] = useState<FilterLabel>('Name');
    const [isAttributeMenuOpen, setIsAttributeMenuOpen] = useState(false);

    const handleFilterChange = useCallback((key: FilterKey, value: string) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    }, []);

    const clearAllFilters = useCallback(() => {
      setFilters({
        name: '',
        kind: '',
        image: '',
        state: '',
        namespace: '',
        idleGpu: '',
      });
    }, []);

    const onAttributeToggleClick = useCallback(() => {
      setIsAttributeMenuOpen((prev) => !prev);
    }, []);

    const attributeDropdown = useMemo(
      () => (
        <Select
          isOpen={isAttributeMenuOpen}
          onSelect={(_ev, itemId) => {
            setActiveAttributeMenu(itemId?.toString() as FilterLabel);
            setIsAttributeMenuOpen(false);
          }}
          selected={activeAttributeMenu}
          onOpenChange={(isOpen) => setIsAttributeMenuOpen(isOpen)}
          toggle={(toggleRef) => (
            <MenuToggle
              ref={toggleRef}
              id="filter-workspaces-dropdown"
              onClick={onAttributeToggleClick}
              isExpanded={isAttributeMenuOpen}
              icon={<FilterIcon />}
            >
              {activeAttributeMenu}
            </MenuToggle>
          )}
        >
          <SelectList>
            {filterConfigs.map(({ key, label }) => (
              <SelectOption key={key} value={label} id={`filter-workspaces-dropdown-${key}`}>
                {label}
              </SelectOption>
            ))}
          </SelectList>
        </Select>
      ),
      [isAttributeMenuOpen, activeAttributeMenu, onAttributeToggleClick],
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

    useImperativeHandle(ref, () => ({
      clearAllFilters,
      setFilter: handleFilterChange,
    }));

    const createWorkspace = useCallback(() => {
      navigate('workspaceCreate');
    }, [navigate]);

    const emptyState = useMemo(
      () => <CustomEmptyState onClearFilters={clearAllFilters} />,
      [clearAllFilters],
    );

    const filterableProperties: Record<FilterKey, (ws: WorkspacesWorkspace) => string> = useMemo(
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

    const setWorkspaceExpanded = (workspace: WorkspacesWorkspace, isExpanding = true) =>
      setExpandedWorkspacesNames((prevExpanded) => {
        const newExpandedWorkspacesNames = prevExpanded.filter(
          (wsName) => wsName !== workspace.name,
        );
        return isExpanding
          ? [...newExpandedWorkspacesNames, workspace.name]
          : newExpandedWorkspacesNames;
      });

    const isWorkspaceExpanded = (workspace: WorkspacesWorkspace) =>
      expandedWorkspacesNames.includes(workspace.name);

    const filteredWorkspaces = useMemo(() => {
      if (workspaces.length === 0) {
        return [];
      }
      const testRegex = (value: string, searchValue: string) => {
        if (!searchValue) {
          return true;
        }
        try {
          return new RegExp(searchValue, 'i').test(value);
        } catch {
          return new RegExp(searchValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(value);
        }
      };

      const activeFilters = Object.entries(filters).filter(([, value]) => value);
      if (activeFilters.length === 0) {
        return workspaces;
      }

      return workspaces.filter((ws) =>
        activeFilters.every(([key, searchValue]) => {
          const propertyGetter = filterableProperties[key as FilterKey];
          return testRegex(propertyGetter(ws), searchValue);
        }),
      );
    }, [workspaces, filters, filterableProperties]);

    // Column sorting

    const getSortableRowValues = (
      workspace: WorkspacesWorkspace,
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

    const extractStateColor = (state: WorkspacesWorkspaceState) => {
      switch (state) {
        case WorkspacesWorkspaceState.WorkspaceStateRunning:
          return 'green';
        case WorkspacesWorkspaceState.WorkspaceStatePending:
          return 'orange';
        case WorkspacesWorkspaceState.WorkspaceStateTerminating:
          return 'yellow';
        case WorkspacesWorkspaceState.WorkspaceStateError:
          return 'red';
        case WorkspacesWorkspaceState.WorkspaceStatePaused:
          return 'purple';
        case WorkspacesWorkspaceState.WorkspaceStateUnknown:
        default:
          return 'grey';
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

    return (
      <>
        <Content style={{ display: 'flex', alignItems: 'flex-start', columnGap: '20px' }}>
          <Toolbar id="workspace-filter-toolbar" clearAllFilters={clearAllFilters}>
            <ToolbarContent>
              <ToolbarToggleGroup toggleIcon={<FilterIcon />} breakpoint="xl">
                <ToolbarGroup variant="filter-group">
                  <ToolbarItem>{attributeDropdown}</ToolbarItem>
                  {filterConfigs.map(({ key, label, placeholder }) => (
                    <ToolbarFilter
                      key={key}
                      labels={filters[key] ? [filters[key]] : []}
                      deleteLabel={() => handleFilterChange(key, '')}
                      deleteLabelGroup={() => handleFilterChange(key, '')}
                      categoryName={label}
                      showToolbarItem={activeAttributeMenu === label}
                    >
                      <ToolbarItem>
                        <ThemeAwareSearchInput
                          value={filters[key]}
                          onChange={(value: string) => handleFilterChange(key, value)}
                          placeholder={placeholder}
                          fieldLabel={placeholder}
                          aria-label={placeholder}
                          data-testid="filter-workspaces-search-input"
                        />
                      </ToolbarItem>
                    </ToolbarFilter>
                  ))}
                  {Object.entries(filters).map(([key, value]) => {
                    // Check if the key is not in the dropdown config and has a value
                    const isWsSummaryFilter = !filterConfigs.some((config) => config.key === key);
                    if (!isWsSummaryFilter || !value) {
                      return null;
                    }

                    return (
                      <ToolbarFilter
                        key={key}
                        labels={[value]}
                        deleteLabel={() => handleFilterChange(key as FilterKey, '')}
                        categoryName={allFiltersConfig[key as FilterKey].label}
                        // eslint-disable-next-line react/no-children-prop
                        children={undefined}
                      />
                    );
                  })}
                  {canCreateWorkspaces && (
                    <ToolbarItem>
                      <Button
                        size="lg"
                        variant="primary"
                        ouiaId="Primary"
                        onClick={createWorkspace}
                      >
                        Create workspace
                      </Button>
                    </ToolbarItem>
                  )}
                </ToolbarGroup>
              </ToolbarToggleGroup>
            </ToolbarContent>
          </Toolbar>
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
            <Tr>
              <Td colSpan={8} id="empty-state-cell">
                <Bullseye>{emptyState}</Bullseye>
              </Td>
            </Tr>
          )}
        </Table>
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
      </>
    );
  },
);

WorkspaceTable.displayName = 'WorkspaceTable';

export default WorkspaceTable;
