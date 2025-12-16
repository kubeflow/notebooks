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
import { FilterIcon } from '@patternfly/react-icons/dist/esm/icons/filter-icon';
import useWorkspaceKinds from '~/app/hooks/useWorkspaceKinds';
import { useWorkspaceCountPerKind } from '~/app/hooks/useWorkspaceCountPerKind';
import { WorkspaceKindsColumns } from '~/app/types';
import ThemeAwareSearchInput from '~/app/components/ThemeAwareSearchInput';
import CustomEmptyState from '~/shared/components/CustomEmptyState';
import WithValidImage from '~/shared/components/WithValidImage';
import ImageFallback from '~/shared/components/ImageFallback';
import { ErrorPopover } from '~/shared/components/ErrorPopover';
import { useTypedNavigate } from '~/app/routerHelper';
import { WorkspacekindsWorkspaceKind } from '~/generated/data-contracts';
import { LoadError } from '~/app/components/LoadError';
import { LoadingSpinner } from '~/app/components/LoadingSpinner';
import { WorkspaceKindDetails } from './details/WorkspaceKindDetails';

export enum ActionType {
  ViewDetails,
}

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

  // Column sorting
  const [activeSortIndex, setActiveSortIndex] = useState<number | null>(1);
  const [activeSortDirection, setActiveSortDirection] = useState<'asc' | 'desc' | null>('asc');

  // Pagination
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

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

  // Set up filter - Attribute search.
  const [searchNameValue, setSearchNameValue] = useState('');
  const [searchDescriptionValue, setSearchDescriptionValue] = useState('');
  const [statusSelection, setStatusSelection] = useState('');

  const onSearchNameChange = useCallback((value: string) => {
    setSearchNameValue(value);
  }, []);

  const onSearchDescriptionChange = useCallback((value: string) => {
    setSearchDescriptionValue(value);
  }, []);

  const onFilter = useCallback(
    (workspaceKind: WorkspacekindsWorkspaceKind) => {
      let nameRegex: RegExp;
      let descriptionRegex: RegExp;

      try {
        nameRegex = new RegExp(searchNameValue, 'i');
        descriptionRegex = new RegExp(searchDescriptionValue, 'i');
      } catch {
        nameRegex = new RegExp(searchNameValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        descriptionRegex = new RegExp(
          searchDescriptionValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
          'i',
        );
      }

      const matchesNameSearch = searchNameValue === '' || nameRegex.test(workspaceKind.name);
      const matchesDescriptionSearch =
        searchDescriptionValue === '' || descriptionRegex.test(workspaceKind.description);

      let matchesStatus = false;
      if (statusSelection === 'Deprecated') {
        matchesStatus = workspaceKind.deprecated === true;
      }
      if (statusSelection === 'Active') {
        matchesStatus = workspaceKind.deprecated === false;
      }

      return (
        matchesNameSearch && matchesDescriptionSearch && (statusSelection === '' || matchesStatus)
      );
    },
    [searchNameValue, searchDescriptionValue, statusSelection],
  );

  const filteredWorkspaceKinds = useMemo(
    () => sortedWorkspaceKinds.filter(onFilter),
    [sortedWorkspaceKinds, onFilter],
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

  const clearAllFilters = useCallback(() => {
    setSearchNameValue('');
    setStatusSelection('');
    setSearchDescriptionValue('');
  }, []);

  // Set up status single select
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState<boolean>(false);

  const onStatusSelect = (
    _event: React.MouseEvent | undefined,
    value: string | number | undefined,
  ) => {
    if (typeof value === 'undefined') {
      return;
    }
    setStatusSelection(value.toString());
    setIsStatusMenuOpen(false);
  };

  const statusSelect = (
    <Select
      isOpen={isStatusMenuOpen}
      selected={statusSelection}
      onSelect={onStatusSelect}
      onOpenChange={(isOpen) => setIsStatusMenuOpen(isOpen)}
      toggle={(toggleRef) => (
        <MenuToggle
          ref={toggleRef}
          onClick={() => setIsStatusMenuOpen(!isStatusMenuOpen)}
          isExpanded={isStatusMenuOpen}
          style={{ width: '200px' } as React.CSSProperties}
          data-testid="filter-status-dropdown"
        >
          Filter by status
        </MenuToggle>
      )}
    >
      <SelectList>
        <SelectOption value="Deprecated" data-testid="filter-status-deprecated">
          Deprecated
        </SelectOption>
        <SelectOption value="Active" data-testid="filter-status-active">
          Active
        </SelectOption>
      </SelectList>
    </Select>
  );

  // Set up attribute selector
  const [activeAttributeMenu, setActiveAttributeMenu] = useState<'Name' | 'Description' | 'Status'>(
    'Name',
  );
  const [isAttributeMenuOpen, setIsAttributeMenuOpen] = useState(false);

  const attributeDropdown = (
    <Select
      isOpen={isAttributeMenuOpen}
      selected={activeAttributeMenu}
      onSelect={(_ev, itemId) => {
        setActiveAttributeMenu(itemId?.toString() as 'Name' | 'Description' | 'Status');
        setIsAttributeMenuOpen(false);
      }}
      onOpenChange={(isOpen) => setIsAttributeMenuOpen(isOpen)}
      toggle={(toggleRef) => (
        <MenuToggle
          ref={toggleRef}
          onClick={() => setIsAttributeMenuOpen(!isAttributeMenuOpen)}
          isExpanded={isAttributeMenuOpen}
          icon={<FilterIcon />}
          data-testid="filter-attribute-dropdown"
        >
          {activeAttributeMenu}
        </MenuToggle>
      )}
    >
      <SelectList>
        <SelectOption value="Name" data-testid="filter-attribute-name">
          Name
        </SelectOption>
        <SelectOption value="Description" data-testid="filter-attribute-description">
          Description
        </SelectOption>
        <SelectOption value="Status" data-testid="filter-attribute-status">
          Status
        </SelectOption>
      </SelectList>
    </Select>
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
              <Toolbar id="attribute-search-filter-toolbar" clearAllFilters={clearAllFilters}>
                <ToolbarContent>
                  <ToolbarToggleGroup toggleIcon={<FilterIcon />} breakpoint="xl">
                    <ToolbarGroup variant="filter-group">
                      <ToolbarItem>{attributeDropdown}</ToolbarItem>
                      <ToolbarFilter
                        labels={searchNameValue !== '' ? [searchNameValue] : ([] as string[])}
                        deleteLabel={() => setSearchNameValue('')}
                        deleteLabelGroup={() => setSearchNameValue('')}
                        categoryName="Name"
                        showToolbarItem={activeAttributeMenu === 'Name'}
                      >
                        <ToolbarItem>
                          <ThemeAwareSearchInput
                            value={searchNameValue}
                            onChange={onSearchNameChange}
                            placeholder="Filter by name"
                            fieldLabel="Find by name"
                            aria-label="Filter by name"
                            data-testid="filter-name-input"
                          />
                        </ToolbarItem>
                      </ToolbarFilter>
                      <ToolbarFilter
                        labels={
                          searchDescriptionValue !== ''
                            ? [searchDescriptionValue]
                            : ([] as string[])
                        }
                        deleteLabel={() => setSearchDescriptionValue('')}
                        deleteLabelGroup={() => setSearchDescriptionValue('')}
                        categoryName="Description"
                        showToolbarItem={activeAttributeMenu === 'Description'}
                      >
                        <ToolbarItem>
                          <ThemeAwareSearchInput
                            value={searchDescriptionValue}
                            onChange={onSearchDescriptionChange}
                            placeholder="Filter by description"
                            fieldLabel="Find by description"
                            aria-label="Filter by description"
                            data-testid="filter-description-input"
                          />
                        </ToolbarItem>
                      </ToolbarFilter>
                      <ToolbarFilter
                        labels={statusSelection !== '' ? [statusSelection] : ([] as string[])}
                        deleteLabel={() => setStatusSelection('')}
                        deleteLabelGroup={() => setStatusSelection('')}
                        categoryName="Status"
                        showToolbarItem={activeAttributeMenu === 'Status'}
                      >
                        {statusSelect}
                      </ToolbarFilter>
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
                    </ToolbarGroup>
                  </ToolbarToggleGroup>
                </ToolbarContent>
              </Toolbar>
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
                              <Label color="red" data-testid="status-label">
                                Deprecated
                              </Label>
                            </Tooltip>
                          ) : (
                            <Label color="green" data-testid="status-label">
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
                              message={workspaceCountResult.error}
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
