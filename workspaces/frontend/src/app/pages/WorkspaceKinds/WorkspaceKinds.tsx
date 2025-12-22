import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerContentBody,
} from '@patternfly/react-core/dist/esm/components/Drawer';
import { PageSection } from '@patternfly/react-core/dist/esm/components/Page';
import {
  Pagination,
  PaginationVariant,
} from '@patternfly/react-core/dist/esm/components/Pagination';
import { Content } from '@patternfly/react-core/dist/esm/components/Content';
import { Tooltip } from '@patternfly/react-core/dist/esm/components/Tooltip';
import { Label } from '@patternfly/react-core/dist/esm/components/Label';
import { ToolbarItem } from '@patternfly/react-core/dist/esm/components/Toolbar';
import { Bullseye } from '@patternfly/react-core/dist/esm/layouts/Bullseye';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
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
import useWorkspaceKinds from '~/app/hooks/useWorkspaceKinds';
import { useWorkspaceCountPerKind } from '~/app/hooks/useWorkspaceCountPerKind';
import { WorkspaceKindsColumns } from '~/app/types';
import CustomEmptyState from '~/shared/components/CustomEmptyState';
import WithValidImage from '~/shared/components/WithValidImage';
import ImageFallback from '~/shared/components/ImageFallback';
import { ErrorPopover } from '~/shared/components/ErrorPopover';
import { useTypedNavigate } from '~/app/routerHelper';
import { WorkspacekindsWorkspaceKind } from '~/generated/data-contracts';
import { LoadError } from '~/app/components/LoadError';
import { LoadingSpinner } from '~/app/components/LoadingSpinner';
import ToolbarFilter, { FilterConfigMap } from '~/shared/components/ToolbarFilter';
import { useToolbarFilters, applyFilters } from '~/shared/hooks/useToolbarFilters';
import {
  WORKSPACE_KIND_STATUS_COLORS,
  extractWorkspaceKindStatusColor,
  WorkspaceKindStatus,
} from '~/shared/utilities/WorkspaceKindUtils';
import { WorkspaceKindDetails } from './details/WorkspaceKindDetails';

export enum ActionType {
  ViewDetails,
}

const filterConfig = {
  name: { type: 'text', label: 'Name', placeholder: 'Filter by name' },
  description: { type: 'text', label: 'Description', placeholder: 'Filter by description' },
  status: {
    type: 'select',
    label: 'Status',
    placeholder: 'Filter by status',
    options: (Object.keys(WORKSPACE_KIND_STATUS_COLORS) as WorkspaceKindStatus[])
      .sort((a, b) => a.localeCompare(b))
      .map((status) => ({
        value: status,
        label: status,
      })),
  },
} as const satisfies FilterConfigMap<string>;

type WorkspaceKindFilterKey = keyof typeof filterConfig;

const visibleFilterKeys: readonly WorkspaceKindFilterKey[] = ['name', 'description', 'status'];

export const WorkspaceKinds: React.FunctionComponent = () => {
  // Table columns
  const columns: WorkspaceKindsColumns = useMemo(
    () => ({
      name: { name: 'Name', label: 'Name', id: 'name' },
      description: { name: 'Description', label: 'Description', id: 'description' },
      deprecated: { name: 'Status', label: 'Status', id: 'status' },
      numberOfWorkspaces: {
        name: 'Workspaces',
        label: 'Workspaces',
        id: 'workspaces',
      },
    }),
    [],
  );

  const navigate = useTypedNavigate();
  const createWorkspaceKind = useCallback(() => {
    navigate('workspaceKindCreate');
  }, [navigate]);
  const [workspaceKinds, workspaceKindsLoaded, workspaceKindsError] = useWorkspaceKinds();
  const workspaceCountResult = useWorkspaceCountPerKind();
  const [selectedWorkspaceKind, setSelectedWorkspaceKind] =
    useState<WorkspacekindsWorkspaceKind | null>(null);
  const [activeActionType, setActiveActionType] = useState<ActionType | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  // Column sorting
  const [activeSortIndex, setActiveSortIndex] = useState<number | null>(1);
  const [activeSortDirection, setActiveSortDirection] = useState<'asc' | 'desc' | null>('asc');

  const getSortableRowValues = useCallback(
    (workspaceKind: WorkspacekindsWorkspaceKind): (string | boolean | number)[] => {
      const {
        name,
        description,
        deprecated,
        numOfWorkspaces: numberOfWorkspaces,
      } = {
        name: workspaceKind.name,
        description: workspaceKind.description,
        deprecated: workspaceKind.deprecated,
        numOfWorkspaces: workspaceCountResult.workspaceCountPerKind[workspaceKind.name]?.count ?? 0,
      };
      return [name, description, deprecated, numberOfWorkspaces];
    },
    [workspaceCountResult],
  );

  const sortedWorkspaceKinds = useMemo(() => {
    if (activeSortIndex === null) {
      return workspaceKinds;
    }

    return [...workspaceKinds].sort((a, b) => {
      const aValue = getSortableRowValues(a)[activeSortIndex];
      const bValue = getSortableRowValues(b)[activeSortIndex];
      if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
        return activeSortDirection === 'asc'
          ? Number(aValue) - Number(bValue)
          : Number(bValue) - Number(aValue);
      }
      return activeSortDirection === 'asc'
        ? (aValue as string).localeCompare(bValue as string)
        : (bValue as string).localeCompare(aValue as string);
    });
  }, [workspaceKinds, activeSortIndex, activeSortDirection, getSortableRowValues]);

  const getSortParams = useCallback(
    (columnIndex: number): ThProps['sort'] => ({
      sortBy: {
        index: activeSortIndex || 0,
        direction: activeSortDirection || 'asc',
        defaultDirection: 'asc',
      },
      onSort: (_event, index, direction) => {
        setActiveSortIndex(index);
        setActiveSortDirection(direction);
      },
      columnIndex,
    }),
    [activeSortIndex, activeSortDirection],
  );

  // Filter
  const { filterValues, setFilter, clearAllFilters } =
    useToolbarFilters<WorkspaceKindFilterKey>(filterConfig);

  const filterableProperties: Record<
    WorkspaceKindFilterKey,
    (wk: WorkspacekindsWorkspaceKind) => string
  > = useMemo(
    () => ({
      name: (wk) => wk.name,
      description: (wk) => wk.description,
      status: (wk) => (wk.deprecated ? 'Deprecated' : 'Active'),
    }),
    [],
  );

  const filteredWorkspaceKinds = useMemo(
    () => applyFilters(sortedWorkspaceKinds, filterValues, filterableProperties),
    [sortedWorkspaceKinds, filterValues, filterableProperties],
  );

  // Reset page when filtered results change and current page is out of bounds
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredWorkspaceKinds.length / perPage) || 1);
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [filteredWorkspaceKinds.length, perPage, page]);

  const onSetPage = useCallback(
    (_event: React.MouseEvent | React.KeyboardEvent | MouseEvent, newPage: number) => {
      setPage(newPage);
    },
    [],
  );

  const onPerPageSelect = useCallback(
    (
      _event: React.MouseEvent | React.KeyboardEvent | MouseEvent,
      newPerPage: number,
      newPage: number,
    ) => {
      setPerPage(newPerPage);
      setPage(newPage);
    },
    [],
  );

  const emptyState = useMemo(
    () => <CustomEmptyState onClearFilters={clearAllFilters} />,
    [clearAllFilters],
  );

  // Actions
  const viewDetailsClick = useCallback((workspaceKind: WorkspacekindsWorkspaceKind) => {
    setSelectedWorkspaceKind(workspaceKind);
    setActiveActionType(ActionType.ViewDetails);
  }, []);

  const workspaceKindsDefaultActions = useCallback(
    (workspaceKind: WorkspacekindsWorkspaceKind): IActions => [
      {
        id: 'view-details',
        title: 'View Details',
        onClick: () => viewDetailsClick(workspaceKind),
      },
      {
        id: 'edit-workspace-kind',
        title: 'Edit',
        onClick: () =>
          navigate('workspaceKindEdit', {
            params: { kind: workspaceKind.name },
            state: { workspaceKindName: workspaceKind.name },
          }),
      },
    ],
    [navigate, viewDetailsClick],
  );

  const workspaceDetailsContent = (
    <>
      {selectedWorkspaceKind && (
        <WorkspaceKindDetails
          workspaceKind={selectedWorkspaceKind}
          workspaceCountResult={workspaceCountResult}
          onCloseClick={() => setSelectedWorkspaceKind(null)}
        />
      )}
    </>
  );

  const DESCRIPTION_CHAR_LIMIT = 50;

  // Toolbar actions
  const toolbarActions = (
    <ToolbarItem>
      <Button
        variant="primary"
        ouiaId="Primary"
        onClick={createWorkspaceKind}
        data-testid="create-workspace-kind-button"
      >
        Create workspace kind
      </Button>
    </ToolbarItem>
  );

  if (workspaceKindsError) {
    return <LoadError title="Failed to load workspace kinds" error={workspaceKindsError} />;
  }

  if (!workspaceKindsLoaded) {
    return <LoadingSpinner />;
  }

  return (
    <Drawer
      isInline
      isExpanded={selectedWorkspaceKind != null && activeActionType === ActionType.ViewDetails}
    >
      <DrawerContent panelContent={workspaceDetailsContent}>
        <DrawerContentBody>
          <PageSection isFilled>
            <Content>
              <h1 data-testid="app-page-title">Workspace kinds</h1>
              <p>View your existing workspace kinds.</p>
            </Content>
            <br />
            <Content style={{ display: 'flex', alignItems: 'flex-start', columnGap: '20px' }}>
              <ToolbarFilter
                filterConfig={filterConfig}
                visibleFilterKeys={visibleFilterKeys}
                filterValues={filterValues}
                onFilterChange={setFilter}
                onClearAllFilters={clearAllFilters}
                toolbarActions={toolbarActions}
                testIdPrefix="filter"
              />
            </Content>
            <Table
              aria-label="Sortable table"
              ouiaId="SortableTable"
              data-testid="workspace-kinds-table"
            >
              <Thead>
                <Tr>
                  {Object.values(columns).map((column, index) => (
                    <Th
                      aria-label={`${column.label} column`}
                      key={`${column.id}-column`}
                      sort={
                        column.id === 'name' || column.id === 'status'
                          ? getSortParams(index)
                          : undefined
                      }
                    >
                      {column.name}
                    </Th>
                  ))}
                  <Th screenReaderText="Primary action" />
                </Tr>
              </Thead>
              {filteredWorkspaceKinds.length > 0 &&
                filteredWorkspaceKinds
                  .slice(perPage * (page - 1), perPage * page)
                  .map((workspaceKind, rowIndex) => (
                    <Tbody
                      id="workspace-kind-table-content"
                      key={rowIndex}
                      data-testid="table-body"
                    >
                      <Tr
                        id={`workspace-kind-table-row-${rowIndex + 1}`}
                        data-testid={`workspace-kind-row-${rowIndex}`}
                      >
                        <Td dataLabel={columns.name.name}>
                          <WithValidImage
                            imageSrc={workspaceKind.icon.url}
                            skeletonWidth="20px"
                            fallback={
                              <span className="pf-v6-u-mr-sm">
                                <ImageFallback imageSrc={workspaceKind.icon.url} />
                              </span>
                            }
                          >
                            {(validSrc) => (
                              <img
                                className="pf-v6-u-mr-sm"
                                src={validSrc}
                                alt={`${workspaceKind.name} icon`}
                                style={{
                                  width: '20px',
                                  height: '20px',
                                  objectFit: 'contain',
                                  verticalAlign: 'middle',
                                }}
                              />
                            )}
                          </WithValidImage>
                          <span data-testid="workspace-kind-name">{workspaceKind.name}</span>
                        </Td>
                        <Td
                          dataLabel={columns.description.name}
                          style={{ maxWidth: '200px', overflow: 'hidden' }}
                          data-testid="workspace-kind-description"
                        >
                          <Tooltip content={workspaceKind.description}>
                            <span>
                              {workspaceKind.description.length > DESCRIPTION_CHAR_LIMIT
                                ? `${workspaceKind.description.slice(0, DESCRIPTION_CHAR_LIMIT)}...`
                                : workspaceKind.description}
                            </span>
                          </Tooltip>
                        </Td>
                        <Td dataLabel={columns.deprecated.name}>
                          {workspaceKind.deprecated ? (
                            <Tooltip content={workspaceKind.deprecationMessage}>
                              <Label
                                color={extractWorkspaceKindStatusColor('Deprecated')}
                                data-testid="status-label"
                              >
                                Deprecated
                              </Label>
                            </Tooltip>
                          ) : (
                            <Label
                              color={extractWorkspaceKindStatusColor('Active')}
                              data-testid="status-label"
                            >
                              Active
                            </Label>
                          )}
                        </Td>
                        <Td
                          dataLabel={columns.numberOfWorkspaces.name}
                          data-testid="workspace-kind-workspace-count"
                        >
                          {workspaceCountResult.error ? (
                            <ErrorPopover
                              title="Failed to load workspace counts"
                              content={workspaceCountResult.error}
                            />
                          ) : (
                            <Button
                              variant="link"
                              className="workspace-kind-summary-button"
                              isInline
                              onClick={() =>
                                navigate('workspaceKindSummary', {
                                  params: { kind: workspaceKind.name },
                                  state: {},
                                })
                              }
                            >
                              {workspaceCountResult.workspaceCountPerKind[workspaceKind.name]
                                ?.count ?? 0}
                              {' Workspaces'}
                            </Button>
                          )}
                        </Td>

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
              {filteredWorkspaceKinds.length === 0 && (
                <Tr>
                  <Td colSpan={8} id="empty-state">
                    <Bullseye>{emptyState}</Bullseye>
                  </Td>
                </Tr>
              )}
            </Table>
            <Pagination
              itemCount={filteredWorkspaceKinds.length}
              widgetId="workspace-kinds-pagination"
              perPage={perPage}
              page={page}
              variant={PaginationVariant.bottom}
              isCompact
              onSetPage={onSetPage}
              onPerPageSelect={onPerPageSelect}
              data-testid="workspace-kinds-pagination"
            />
          </PageSection>
        </DrawerContentBody>
      </DrawerContent>
    </Drawer>
  );
};
