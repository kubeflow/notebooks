import * as React from 'react';
import {
  PageSection,
  TimestampTooltipVariant,
  Timestamp,
  Label,
  Title,
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
import { useState } from 'react';
import { Workspace, WorkspaceState } from '~/shared/types';
import Filter from '~/shared/components/Filter';

/* Mocked workspaces, to be removed after fetching info from backend */
const mockWorkspaces: Workspace[] = [
  {
    name: 'My Jupyter Notebook',
    namespace: 'namespace1',
    paused: true,
    deferUpdates: true,
    kind: 'jupyter-lab',
    podTemplate: {
      volumes: {
        home: '/home',
        data: [
          {
            pvcName: 'data',
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
    podTemplate: {
      volumes: {
        home: '/home',
        data: [
          {
            pvcName: 'data',
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
  {
    name: 'test1',
    namespace: 'namespace1',
    paused: false,
    deferUpdates: false,
    kind: 'jupyter-lab',
    podTemplate: {
      volumes: {
        home: '/home',
        data: [
          {
            pvcName: 'data',
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
      stateMessage: 'It is running.',
    },
  },
  {
    name: 'test2',
    namespace: 'namespace1',
    paused: false,
    deferUpdates: false,
    kind: 'jupyter-lab',
    podTemplate: {
      volumes: {
        home: '/home',
        data: [
          {
            pvcName: 'data',
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
const columnNames = {
  name: 'Name',
  kind: 'Kind',
  image: 'Image',
  podConfig: 'Pod Config',
  state: 'State',
  homeVol: 'Home Vol',
  dataVol: 'Data Vol',
  lastActivity: 'Last Activity',
};

export const Workspaces: React.FunctionComponent = () => {
  // change when fetch workspaces is implemented
  const initialWorkspaces = mockWorkspaces;
  const [workspaces, setWorkspaces] = useState(initialWorkspaces);

  // filter function to pass to the filter component
  const onFilter = (filters: { filterName: string; value: string }[]) => {
    // Search name with search value
    let filteredWorkspaces = initialWorkspaces;
    filters.forEach((filter) => {
      let searchValueInput: RegExp;
      try {
        searchValueInput = new RegExp(filter.value, 'i');
      } catch {
        searchValueInput = new RegExp(filter.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      }
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      // eslint-disable-next-line array-callback-return
      filteredWorkspaces = filteredWorkspaces.filter((workspace) => {
        if (filter.value === '') {
          return true;
        }
        switch (filter.filterName) {
          case 'Name':
            return workspace.name.search(searchValueInput) >= 0;
          case 'Kind':
            return workspace.kind.search(searchValueInput) >= 0;
          case 'Image':
            return workspace.options.imageConfig.search(searchValueInput) >= 0;
          case 'Pod Config':
            return workspace.options.podConfig.search(searchValueInput) >= 0;
          case 'State':
            return WorkspaceState[workspace.status.state].search(searchValueInput) >= 0;
          case 'Home Vol':
            return workspace.podTemplate.volumes.home.search(searchValueInput) >= 0;
          case 'Data Vol':
            return workspace.podTemplate.volumes.data.some(
              (dataVol) =>
                dataVol.pvcName.search(searchValueInput) >= 0 ||
                dataVol.mountPath.search(searchValueInput) >= 0,
            );
          default:
        }
      });
    });
    setWorkspaces(filteredWorkspaces);
  };

  // Column sorting

  const [activeSortIndex, setActiveSortIndex] = React.useState<number | null>(null);
  const [activeSortDirection, setActiveSortDirection] = React.useState<'asc' | 'desc' | null>(null);

  const getSortableRowValues = (workspace: Workspace): (string | number)[] => {
    const { name, kind, image, podConfig, state, homeVol, dataVol, lastActivity } = {
      name: workspace.name,
      kind: workspace.kind,
      image: workspace.options.imageConfig,
      podConfig: workspace.options.podConfig,
      state: WorkspaceState[workspace.status.state],
      homeVol: workspace.podTemplate.volumes.home,
      dataVol: workspace.podTemplate.volumes.data[0].pvcName || '',
      lastActivity: workspace.status.activity.lastActivity,
    };
    return [name, kind, image, podConfig, state, homeVol, dataVol, lastActivity];
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
      <Filter id="filter-workspaces" onFilter={onFilter} columnNames={columnNames} />
      <Table aria-label="Sortable table" ouiaId="SortableTable">
        <Thead>
          <Tr>
            {Object.values(columnNames).map((columnName, index) => (
              <Th key={`${columnName}-col-name`} sort={getSortParams(index)}>
                {columnName}
              </Th>
            ))}
            <Th screenReaderText="Primary action" />
          </Tr>
        </Thead>
        <Tbody id="workspaces-table-content">
          {sortedWorkspaces.map((workspace, rowIndex) => (
            <Tr id={`workspaces-table-row-${rowIndex + 1}`} key={rowIndex}>
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
              <Td dataLabel={columnNames.dataVol}>
                {workspace.podTemplate.volumes.data[0].pvcName || ''}
              </Td>
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
          ))}
        </Tbody>
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
