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
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  Menu,
  MenuContent,
  MenuList,
  MenuItem,
  MenuToggle,
  Popper,
  ToolbarGroup,
  ToolbarFilter,
  ToolbarToggleGroup,
  Bullseye,
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
import { CodeIcon, FilterIcon } from '@patternfly/react-icons';
import { WorkspaceKind } from '~/shared/api/backendApiTypes';
import useWorkspaceKinds from '~/app/hooks/useWorkspaceKinds';
import { useWorkspaceCountPerKind } from '~/app/hooks/useWorkspaceCountPerKind';
import { WorkspaceKindsColumns } from '~/app/types';
import ThemeAwareSearchInput from '~/app/components/ThemeAwareSearchInput';
import CustomEmptyState from '~/shared/components/CustomEmptyState';
import { WorkspaceKindDetails } from './details/WorkspaceKindDetails';

export enum ActionType {
  ViewDetails,
}

export const WorkspaceKinds: React.FunctionComponent = () => {
  // Table columns
  const columns: WorkspaceKindsColumns = React.useMemo(
    () => ({
      icon: { name: '', label: 'Icon', id: 'icon' },
      name: { name: 'Name', label: 'Name', id: 'name' },
      description: { name: 'Description', label: 'Description', id: 'description' },
      deprecated: { name: 'Status', label: 'Status', id: 'status' },
      numberOfWorkspaces: {
        name: 'Number of workspaces',
        label: 'Number of workspaces',
        id: 'number-of-workspaces',
      },
    }),
    [],
  );

  const [workspaceKinds, workspaceKindsLoaded, workspaceKindsError] = useWorkspaceKinds();
  const workspaceCountPerKind = useWorkspaceCountPerKind();
  const [selectedWorkspaceKind, setSelectedWorkspaceKind] = React.useState<WorkspaceKind | null>(
    null,
  );
  const [activeActionType, setActiveActionType] = React.useState<ActionType | null>(null);

  // Column sorting
  const [activeSortIndex, setActiveSortIndex] = React.useState<number | null>(null);
  const [activeSortDirection, setActiveSortDirection] = React.useState<'asc' | 'desc' | null>(null);

  const getSortableRowValues = React.useCallback(
    (workspaceKind: WorkspaceKind): (string | boolean | number)[] => {
      const {
        icon,
        name,
        description,
        deprecated,
        numOfWorkspaces: numberOfWorkspaces,
      } = {
        icon: '',
        name: workspaceKind.name,
        description: workspaceKind.description,
        deprecated: workspaceKind.deprecated,
        numOfWorkspaces: workspaceCountPerKind[workspaceKind.name] ?? 0,
      };
      return [icon, name, description, deprecated, numberOfWorkspaces];
    },
    [workspaceCountPerKind],
  );

  const sortedWorkspaceKinds = React.useMemo(() => {
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

  const getSortParams = React.useCallback(
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
  const [searchNameValue, setSearchNameValue] = React.useState('');
  const [searchDescriptionValue, setSearchDescriptionValue] = React.useState('');
  const [statusSelection, setStatusSelection] = React.useState('');

  const onSearchNameChange = React.useCallback((value: string) => {
    setSearchNameValue(value);
  }, []);

  const onSearchDescriptionChange = React.useCallback((value: string) => {
    setSearchDescriptionValue(value);
  }, []);

  const onFilter = React.useCallback(
    (workspaceKind: WorkspaceKind) => {
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

  const filteredWorkspaceKinds = React.useMemo(
    () => sortedWorkspaceKinds.filter(onFilter),
    [sortedWorkspaceKinds, onFilter],
  );

  const clearAllFilters = React.useCallback(() => {
    setSearchNameValue('');
    setStatusSelection('');
    setSearchDescriptionValue('');
  }, []);

  // Set up status single select
  const [isStatusMenuOpen, setIsStatusMenuOpen] = React.useState<boolean>(false);
  const statusToggleRef = React.useRef<HTMLButtonElement>(null);
  const statusMenuRef = React.useRef<HTMLDivElement>(null);
  const statusContainerRef = React.useRef<HTMLDivElement>(null);

  const handleStatusMenuKeys = React.useCallback(
    (event: KeyboardEvent) => {
      if (isStatusMenuOpen && statusMenuRef.current?.contains(event.target as Node)) {
        if (event.key === 'Escape' || event.key === 'Tab') {
          setIsStatusMenuOpen(!isStatusMenuOpen);
          statusToggleRef.current?.focus();
        }
      }
    },
    [isStatusMenuOpen],
  );

  const handleStatusClickOutside = React.useCallback(
    (event: MouseEvent) => {
      if (isStatusMenuOpen && !statusMenuRef.current?.contains(event.target as Node)) {
        setIsStatusMenuOpen(false);
      }
    },
    [isStatusMenuOpen],
  );

  React.useEffect(() => {
    window.addEventListener('keydown', handleStatusMenuKeys);
    window.addEventListener('click', handleStatusClickOutside);
    return () => {
      window.removeEventListener('keydown', handleStatusMenuKeys);
      window.removeEventListener('click', handleStatusClickOutside);
    };
  }, [isStatusMenuOpen, statusMenuRef, handleStatusClickOutside, handleStatusMenuKeys]);

  const onStatusToggleClick = React.useCallback((ev: React.MouseEvent) => {
    ev.stopPropagation();
    setTimeout(() => {
      const firstElement = statusMenuRef.current?.querySelector('li > button:not(:disabled)');
      if (firstElement) {
        (firstElement as HTMLElement).focus();
      }
    }, 0);
    setIsStatusMenuOpen((prev) => !prev);
  }, []);

  const onStatusSelect = React.useCallback(
    (event: React.MouseEvent | undefined, itemId: string | number | undefined) => {
      if (typeof itemId === 'undefined') {
        return;
      }

      setStatusSelection(itemId.toString());
      setIsStatusMenuOpen((prev) => !prev);
    },
    [],
  );

  const statusToggle = React.useMemo(
    () => (
      <MenuToggle
        ref={statusToggleRef}
        onClick={onStatusToggleClick}
        isExpanded={isStatusMenuOpen}
        style={{ width: '200px' } as React.CSSProperties}
      >
        Filter by status
      </MenuToggle>
    ),
    [isStatusMenuOpen, onStatusToggleClick],
  );

  const statusMenu = React.useMemo(
    () => (
      <Menu
        ref={statusMenuRef}
        id="attribute-search-status-menu"
        onSelect={onStatusSelect}
        selected={statusSelection}
      >
        <MenuContent>
          <MenuList>
            <MenuItem itemId="Deprecated">Deprecated</MenuItem>
            <MenuItem itemId="Active">Active</MenuItem>
          </MenuList>
        </MenuContent>
      </Menu>
    ),
    [statusSelection, onStatusSelect],
  );

  const statusSelect = React.useMemo(
    () => (
      <div ref={statusContainerRef}>
        <Popper
          trigger={statusToggle}
          triggerRef={statusToggleRef}
          popper={statusMenu}
          popperRef={statusMenuRef}
          appendTo={statusContainerRef.current || undefined}
          isVisible={isStatusMenuOpen}
        />
      </div>
    ),
    [statusToggle, statusMenu, isStatusMenuOpen],
  );

  // Set up attribute selector
  const [activeAttributeMenu, setActiveAttributeMenu] = React.useState<
    'Name' | 'Description' | 'Status'
  >('Name');
  const [isAttributeMenuOpen, setIsAttributeMenuOpen] = React.useState(false);
  const attributeToggleRef = React.useRef<HTMLButtonElement>(null);
  const attributeMenuRef = React.useRef<HTMLDivElement>(null);
  const attributeContainerRef = React.useRef<HTMLDivElement>(null);

  const handleAttributeMenuKeys = React.useCallback(
    (event: KeyboardEvent) => {
      if (!isAttributeMenuOpen) {
        return;
      }
      if (
        attributeMenuRef.current?.contains(event.target as Node) ||
        attributeToggleRef.current?.contains(event.target as Node)
      ) {
        if (event.key === 'Escape' || event.key === 'Tab') {
          setIsAttributeMenuOpen(!isAttributeMenuOpen);
          attributeToggleRef.current?.focus();
        }
      }
    },
    [isAttributeMenuOpen],
  );

  const handleAttributeClickOutside = React.useCallback(
    (event: MouseEvent) => {
      if (isAttributeMenuOpen && !attributeMenuRef.current?.contains(event.target as Node)) {
        setIsAttributeMenuOpen(false);
      }
    },
    [isAttributeMenuOpen],
  );

  React.useEffect(() => {
    window.addEventListener('keydown', handleAttributeMenuKeys);
    window.addEventListener('click', handleAttributeClickOutside);
    return () => {
      window.removeEventListener('keydown', handleAttributeMenuKeys);
      window.removeEventListener('click', handleAttributeClickOutside);
    };
  }, [isAttributeMenuOpen, attributeMenuRef, handleAttributeMenuKeys, handleAttributeClickOutside]);

  const onAttributeToggleClick = React.useCallback((ev: React.MouseEvent) => {
    ev.stopPropagation();

    setTimeout(() => {
      const firstElement = attributeMenuRef.current?.querySelector('li > button:not(:disabled)');
      if (firstElement) {
        (firstElement as HTMLElement).focus();
      }
    }, 0);

    setIsAttributeMenuOpen((prev) => !prev);
  }, []);

  const attributeToggle = React.useMemo(
    () => (
      <MenuToggle
        ref={attributeToggleRef}
        onClick={onAttributeToggleClick}
        isExpanded={isAttributeMenuOpen}
        icon={<FilterIcon />}
      >
        {activeAttributeMenu}
      </MenuToggle>
    ),
    [isAttributeMenuOpen, onAttributeToggleClick, activeAttributeMenu],
  );

  const attributeMenu = React.useMemo(
    () => (
      <Menu
        ref={attributeMenuRef}
        onSelect={(_ev, itemId) => {
          setActiveAttributeMenu(itemId?.toString() as 'Name' | 'Description' | 'Status');
          setIsAttributeMenuOpen((prev) => !prev);
        }}
      >
        <MenuContent>
          <MenuList>
            <MenuItem itemId="Name">Name</MenuItem>
            <MenuItem itemId="Description">Description</MenuItem>
            <MenuItem itemId="Status">Status</MenuItem>
          </MenuList>
        </MenuContent>
      </Menu>
    ),
    [],
  );

  const attributeDropdown = React.useMemo(
    () => (
      <div ref={attributeContainerRef}>
        <Popper
          trigger={attributeToggle}
          triggerRef={attributeToggleRef}
          popper={attributeMenu}
          popperRef={attributeMenuRef}
          appendTo={attributeContainerRef.current || undefined}
          isVisible={isAttributeMenuOpen}
        />
      </div>
    ),
    [attributeToggle, attributeMenu, isAttributeMenuOpen],
  );

  const emptyState = React.useMemo(
    () => <CustomEmptyState onClearFilters={clearAllFilters} />,
    [clearAllFilters],
  );

  // Actions

  const viewDetailsClick = React.useCallback((workspaceKind: WorkspaceKind) => {
    setSelectedWorkspaceKind(workspaceKind);
    setActiveActionType(ActionType.ViewDetails);
  }, []);

  const workspaceKindsDefaultActions = React.useCallback(
    (workspaceKind: WorkspaceKind): IActions => [
      {
        id: 'view-details',
        title: 'View Details',
        onClick: () => viewDetailsClick(workspaceKind),
      },
    ],
    [viewDetailsClick],
  );

  const workspaceDetailsContent = (
    <>
      {selectedWorkspaceKind && (
        <WorkspaceKindDetails
          workspaceKind={selectedWorkspaceKind}
          onCloseClick={() => setSelectedWorkspaceKind(null)}
        />
      )}
    </>
  );

  const DESCRIPTION_CHAR_LIMIT = 50;

  if (workspaceKindsError) {
    return <p>Error loading workspace kinds: {workspaceKindsError.message}</p>; // TODO: UX for error state
  }

  if (!workspaceKindsLoaded) {
    return <p>Loading...</p>; // TODO: UX for loading state
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
              <h1>Kubeflow Workspace Kinds</h1>
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
                            placeholder="Filter by Name"
                            fieldLabel="Find by Name"
                            aria-label="Filter by Name"
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
                            placeholder="Filter by Description"
                            fieldLabel="Find by Description"
                            aria-label="Filter by Description"
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
                    </ToolbarGroup>
                  </ToolbarToggleGroup>
                </ToolbarContent>
              </Toolbar>
              {/* <Button variant="primary" ouiaId="Primary">
                Create Workspace Kind // Todo: show only in case of an admin user.
              </Button> */}
            </Content>
            <Table aria-label="Sortable table" ouiaId="SortableTable">
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
                filteredWorkspaceKinds.map((workspaceKind, rowIndex) => (
                  <Tbody id="workspace-kind-table-content" key={rowIndex} data-testid="table-body">
                    <Tr id={`workspace-kind-table-row-${rowIndex + 1}`}>
                      <Td dataLabel={columns.icon.name} style={{ width: '50px' }}>
                        {workspaceKind.icon.url ? (
                          <Brand
                            src={workspaceKind.icon.url}
                            alt={workspaceKind.name}
                            style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                          />
                        ) : (
                          <CodeIcon />
                        )}
                      </Td>
                      <Td dataLabel={columns.name.name}>{workspaceKind.name}</Td>
                      <Td
                        dataLabel={columns.description.name}
                        style={{ maxWidth: '200px', overflow: 'hidden' }}
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
                            <Label color="red">Deprecated</Label>
                          </Tooltip>
                        ) : (
                          <Label color="green">Active</Label>
                        )}
                      </Td>
                      <Td dataLabel={columns.numberOfWorkspaces.name}>
                        {workspaceCountPerKind[workspaceKind.name] ?? 0}
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
          </PageSection>
        </DrawerContentBody>
      </DrawerContent>
    </Drawer>
  );
};
