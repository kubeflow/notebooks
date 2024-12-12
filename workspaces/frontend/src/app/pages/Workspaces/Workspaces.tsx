import * as React from 'react';
import {
  PageSection,
  MenuToggle,
  TimestampTooltipVariant,
  Timestamp,
  Label,
  Title,
  Popper,
  MenuToggleElement,
  Menu,
  MenuContent,
  MenuList,
  MenuItem,
  Toolbar,
  ToolbarContent,
  ToolbarToggleGroup,
  ToolbarGroup,
  ToolbarItem,
  ToolbarFilter,
  SearchInput,
  Button,
  PaginationVariant,
  Pagination,
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
import { FilterIcon } from '@patternfly/react-icons';
import { Workspace, WorkspacesColumnNames, WorkspaceState } from '~/shared/types';

import { ExpandedWorkspaceRow } from '~/app/pages/Workspaces/ExpandedWorkspaceRow';
import { formatRam } from 'shared/utilities/WorkspaceResources';

export const Workspaces: React.FunctionComponent = () => {
  /* Mocked workspaces, to be removed after fetching info from backend */
  const workspaces: Workspace[] = [
    {
      name: 'My Jupyter Notebook',
      namespace: 'namespace1',
      paused: true,
      deferUpdates: true,
      kind: 'jupyter-lab',
      cpu: 3,
      ram: 500,
      podTemplate: {
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

  // Filter
  const [activeAttributeMenu, setActiveAttributeMenu] = React.useState<string>(columnNames.name);
  const [isAttributeMenuOpen, setIsAttributeMenuOpen] = React.useState(false);
  const attributeToggleRef = React.useRef<MenuToggleElement | null>(null);
  const attributeMenuRef = React.useRef<HTMLDivElement | null>(null);
  const attributeContainerRef = React.useRef<HTMLDivElement | null>(null);

  const [searchValue, setSearchValue] = React.useState('');
  const [expandedWorkspacesNames, setExpandedWorkspacesNames] = React.useState<string[]>([]);

  const setWorkspaceExpanded = (workspace: Workspace, isExpanding = true) =>
    setExpandedWorkspacesNames((prevExpanded) => {
      const newExpandedWorkspacesNames = prevExpanded.filter((wsName) => wsName !== workspace.name);
      return isExpanding
        ? [...newExpandedWorkspacesNames, workspace.name]
        : newExpandedWorkspacesNames;
    });

  const isWorkspaceExpanded = (workspace: Workspace) =>
    expandedWorkspacesNames.includes(workspace.name);

  const searchInput = (
    <SearchInput
      placeholder="Filter by name"
      value={searchValue}
      onChange={(_event, value) => onSearchChange(value)}
      onClear={() => onSearchChange('')}
    />
  );

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
    [isAttributeMenuOpen, attributeMenuRef, attributeToggleRef],
  );

  const handleAttributeClickOutside = React.useCallback(
    (event: MouseEvent) => {
      if (isAttributeMenuOpen && !attributeMenuRef.current?.contains(event.target as Node)) {
        setIsAttributeMenuOpen(false);
      }
    },
    [isAttributeMenuOpen, attributeMenuRef],
  );

  React.useEffect(() => {
    window.addEventListener('keydown', handleAttributeMenuKeys);
    window.addEventListener('click', handleAttributeClickOutside);
    return () => {
      window.removeEventListener('keydown', handleAttributeMenuKeys);
      window.removeEventListener('click', handleAttributeClickOutside);
    };
  }, [isAttributeMenuOpen, attributeMenuRef, handleAttributeMenuKeys, handleAttributeClickOutside]);

  const onAttributeToggleClick = (ev: React.MouseEvent) => {
    ev.stopPropagation(); // Stop handleClickOutside from handling
    setTimeout(() => {
      if (attributeMenuRef.current) {
        const firstElement = attributeMenuRef.current.querySelector('li > button:not(:disabled)');
        if (firstElement) {
          (firstElement as HTMLElement).focus();
        }
      }
    }, 0);
    setIsAttributeMenuOpen(!isAttributeMenuOpen);
  };

  const attributeToggle = (
    <MenuToggle
      ref={attributeToggleRef}
      onClick={onAttributeToggleClick}
      isExpanded={isAttributeMenuOpen}
      icon={<FilterIcon />}
    >
      {activeAttributeMenu}
    </MenuToggle>
  );

  const attributeMenu = (
    <Menu
      ref={attributeMenuRef}
      onSelect={(_ev, itemId) => {
        setActiveAttributeMenu(itemId?.toString());
        setIsAttributeMenuOpen(!isAttributeMenuOpen);
      }}
    >
      <MenuContent>
        <MenuList>
          <MenuItem itemId="Name">Name</MenuItem>
          <MenuItem itemId="Kind">Kind</MenuItem>
          <MenuItem itemId="Image">Image</MenuItem>
          <MenuItem itemId="Pod Config">Pod Config</MenuItem>
          <MenuItem itemId="State">State</MenuItem>
          <MenuItem itemId="Home Vol">Home Vol</MenuItem>
          <MenuItem itemId="Data Vol">Data Vol</MenuItem>
          <MenuItem itemId="Last Activity">Last Activity</MenuItem>
        </MenuList>
      </MenuContent>
    </Menu>
  );

  const attributeDropdown = (
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
  );

  const toolbar = (
    <Toolbar
      id="attribute-search-filter-toolbar"
      clearAllFilters={() => {
        setSearchValue('');
      }}
    >
      <ToolbarContent>
        <ToolbarToggleGroup toggleIcon={<FilterIcon />} breakpoint="xl">
          <ToolbarGroup variant="filter-group">
            <ToolbarItem>{attributeDropdown}</ToolbarItem>
            <ToolbarFilter
              labels={searchValue !== '' ? [searchValue] : ([] as string[])}
              deleteLabel={() => setSearchValue('')}
              deleteLabelGroup={() => setSearchValue('')}
              categoryName={activeAttributeMenu}
            >
              {searchInput}
            </ToolbarFilter>
            <Button variant="primary" ouiaId="Primary">
              Create Workspace
            </Button>
          </ToolbarGroup>
        </ToolbarToggleGroup>
      </ToolbarContent>
    </Toolbar>
  );

  const onSearchChange = (value: string) => {
    setSearchValue(value);
  };

  const onFilter = (workspace: Workspace) => {
    // Search name with search value
    let searchValueInput: RegExp;
    try {
      searchValueInput = new RegExp(searchValue, 'i');
    } catch {
      searchValueInput = new RegExp(searchValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    }

    return (
      searchValue === '' ||
      (activeAttributeMenu === 'Name' && workspace.name.search(searchValueInput) >= 0) ||
      (activeAttributeMenu === 'Kind' && workspace.kind.search(searchValueInput) >= 0) ||
      (activeAttributeMenu === 'Image' &&
        workspace.options.imageConfig.search(searchValueInput) >= 0) ||
      (activeAttributeMenu === 'Pod Config' &&
        workspace.options.podConfig.search(searchValueInput) >= 0) ||
      (activeAttributeMenu === 'State' &&
        WorkspaceState[workspace.status.state].search(searchValueInput) >= 0) ||
      (activeAttributeMenu === 'Home Vol' &&
        workspace.podTemplate.volumes.home.search(searchValueInput) >= 0) ||
      (activeAttributeMenu === 'Data Vol' &&
        workspace.podTemplate.volumes.data.some(
          (dataVol) =>
            dataVol.pvcName.search(searchValueInput) >= 0 ||
            dataVol.mountPath.search(searchValueInput) >= 0,
        ))
    );
  };
  const filteredWorkspaces = workspaces.filter(onFilter);

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

  let sortedWorkspaces = filteredWorkspaces;
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

  const defaultActions = (workspace: Workspace): IActions =>
    [
      {
        title: 'Edit',
        onClick: () => console.log(`Clicked on edit, on row ${workspace.name}`),
      },
      {
        title: 'Delete',
        onClick: () => console.log(`Clicked on delete, on row ${workspace.name}`),
      },
      {
        isSeparator: true,
      },
      {
        title: 'Start/restart',
        onClick: () => console.log(`Clicked on start/restart, on row ${workspace.name}`),
      },
      {
        title: 'Stop',
        onClick: () => console.log(`Clicked on stop, on row ${workspace.name}`),
      },
    ] as IActions;

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

  return (
    <PageSection>
      <Title headingLevel="h1">Kubeflow Workspaces</Title>
      <p>View your existing workspaces or create new workspaces.</p>
      {toolbar}
      <Table aria-label="Sortable table" ouiaId="SortableTable">
        <Thead>
          <Tr>
            <Th />
            <Th sort={getSortParams(0)}>{columnNames.name}</Th>
            <Th sort={getSortParams(1)}>{columnNames.kind}</Th>
            <Th sort={getSortParams(2)}>{columnNames.image}</Th>
            <Th sort={getSortParams(3)}>{columnNames.podConfig}</Th>
            <Th sort={getSortParams(4)}>{columnNames.state}</Th>
            <Th sort={getSortParams(5)}>{columnNames.homeVol}</Th>
            <Th sort={getSortParams(6)} info={{ tooltip: 'Workspace CPU usage' }}>
              {columnNames.cpu}
            </Th>
            <Th sort={getSortParams(7)} info={{ tooltip: 'Workspace memory usage' }}>
              {columnNames.ram}
            </Th>
            <Th sort={getSortParams(8)}>{columnNames.lastActivity}</Th>
            <Th screenReaderText="Primary action" />
          </Tr>
        </Thead>
        {sortedWorkspaces.map((workspace, rowIndex) => (
          <Tbody key={rowIndex} isExpanded={isWorkspaceExpanded(workspace)}>
            <Tr>
              <Td
                expand={{
                  rowIndex,
                  isExpanded: isWorkspaceExpanded(workspace),
                  onToggle: () => setWorkspaceExpanded(workspace, !isWorkspaceExpanded(workspace)),
                }}
              />
              <Td dataLabel={columnNames.name}>{workspace.name}</Td>
              <Td dataLabel={columnNames.kind}>{workspace.kind}</Td>
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
              <Td isActionCell>
                <ActionsColumn items={defaultActions(workspace)} />
              </Td>
            </Tr>
            {isWorkspaceExpanded(workspace) && (
              <ExpandedWorkspaceRow workspace={workspace} columnNames={columnNames} />
            )}
          </Tbody>
        ))}
      </Table>
      <Pagination
        itemCount={333}
        widgetId="bottom-example"
        perPage={perPage}
        page={page}
        variant={PaginationVariant.bottom}
        onSetPage={onSetPage}
        onPerPageSelect={onPerPageSelect}
      />
    </PageSection>
  );
};
