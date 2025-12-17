import { mockModArchResponse } from 'mod-arch-core';
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow';
import {
  deleteModal,
  startModal,
  stopModal,
  workspaceDetailsDrawer,
  workspaces,
} from '~/__tests__/cypress/cypress/pages/workspaces/workspaces';
import {
  buildMockActionsWorkspaceActionPause,
  buildMockNamespace,
  buildMockWorkspace,
  buildMockWorkspaceKindInfo,
  buildMockWorkspaceList,
} from '~/shared/mock/mockBuilder';
import { createMockPodTemplateWithImage } from '~/__tests__/cypress/cypress/utils/testBuilders';
import { NOTEBOOKS_API_VERSION } from '~/__tests__/cypress/cypress/support/commands/api';
import { navBar } from '~/__tests__/cypress/cypress/pages/components/navBar';
import { WorkspacesWorkspaceState } from '~/generated/data-contracts';

const DEFAULT_NAMESPACE = 'default';
const KUBEFLOW_NAMESPACE = 'kubeflow';
const DEFAULT_PAGE_SIZE = 10;
const TEST_WORKSPACE_NAME = 'Workspace';
const TOTAL_FILTER_TEST_WORKSPACES = 5;

type NamespaceSetup = {
  mockNamespace: ReturnType<typeof buildMockNamespace>;
  mockWorkspaces: ReturnType<typeof buildMockWorkspaceList>;
};

type MultiNamespaceSetup = {
  mockDefaultNs: ReturnType<typeof buildMockNamespace>;
  mockKubeflowNs: ReturnType<typeof buildMockNamespace>;
  defaultNsWorkspaces: ReturnType<typeof buildMockWorkspaceList>;
  kubeflowNsWorkspaces: ReturnType<typeof buildMockWorkspaceList>;
};

const setupSingleNamespaceWorkspaces = (
  namespaceName: string,
  workspaceCount: number,
  kindName = 'jupyterlab',
): NamespaceSetup => {
  const mockNamespace = buildMockNamespace({ name: namespaceName });
  const mockWorkspaceKind = buildMockWorkspaceKindInfo({ name: kindName });
  const mockWorkspaces = buildMockWorkspaceList({
    count: workspaceCount,
    namespace: mockNamespace.name,
    kind: mockWorkspaceKind,
  });

  cy.interceptApi(
    'GET /api/:apiVersion/namespaces',
    { path: { apiVersion: NOTEBOOKS_API_VERSION } },
    mockModArchResponse([mockNamespace]),
  ).as('getNamespaces');

  cy.interceptApi(
    'GET /api/:apiVersion/workspaces/:namespace',
    { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockNamespace.name } },
    mockModArchResponse(mockWorkspaces),
  ).as('getWorkspaces');

  return { mockNamespace, mockWorkspaces };
};

const setupMultiNamespaceWorkspaces = (
  defaultCount: number,
  kubeflowCount: number,
): MultiNamespaceSetup => {
  const mockDefaultNs = buildMockNamespace({ name: DEFAULT_NAMESPACE });
  const mockKubeflowNs = buildMockNamespace({ name: KUBEFLOW_NAMESPACE });
  const mockWorkspaceKind = buildMockWorkspaceKindInfo({ name: 'jupyterlab' });

  const defaultNsWorkspaces = buildMockWorkspaceList({
    count: defaultCount,
    namespace: mockDefaultNs.name,
    kind: mockWorkspaceKind,
  });

  const kubeflowNsWorkspaces = buildMockWorkspaceList({
    count: kubeflowCount,
    namespace: mockKubeflowNs.name,
    kind: mockWorkspaceKind,
  });

  cy.interceptApi(
    'GET /api/:apiVersion/namespaces',
    { path: { apiVersion: NOTEBOOKS_API_VERSION } },
    mockModArchResponse([mockDefaultNs, mockKubeflowNs]),
  ).as('getNamespaces');

  cy.interceptApi(
    'GET /api/:apiVersion/workspaces/:namespace',
    { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockDefaultNs.name } },
    mockModArchResponse(defaultNsWorkspaces),
  ).as('getDefaultNsWorkspaces');

  cy.interceptApi(
    'GET /api/:apiVersion/workspaces/:namespace',
    { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockKubeflowNs.name } },
    mockModArchResponse(kubeflowNsWorkspaces),
  ).as('getKubeflowNsWorkspaces');

  return { mockDefaultNs, mockKubeflowNs, defaultNsWorkspaces, kubeflowNsWorkspaces };
};

const navigateToNamespace = (namespaceName: string) => {
  workspaces.visit();
  cy.wait('@getNamespaces');
  navBar.selectNamespace(namespaceName);
  cy.wait('@getWorkspaces');
};

const createFilterTestWorkspaces = () => {
  const mockPodTemplate = createMockPodTemplateWithImage;
  return [
    buildMockWorkspace({
      name: 'Workspace 1',
      workspaceKind: buildMockWorkspaceKindInfo({ name: 'jupyterlab' }),
      state: WorkspacesWorkspaceState.WorkspaceStateRunning,
      podTemplate: mockPodTemplate('jupyter-scipy:v1.0.0'),
    }),
    buildMockWorkspace({
      name: 'Workspace 2',
      workspaceKind: buildMockWorkspaceKindInfo({ name: 'jupyterlab' }),
      state: WorkspacesWorkspaceState.WorkspaceStateRunning,
      podTemplate: mockPodTemplate('jupyter-scipy:v1.0.0'),
    }),
    buildMockWorkspace({
      name: 'Workspace 3',
      workspaceKind: buildMockWorkspaceKindInfo({ name: 'jupyterlab' }),
      state: WorkspacesWorkspaceState.WorkspaceStatePaused,
      podTemplate: mockPodTemplate('jupyter-scipy:v2.0.0'),
    }),
    buildMockWorkspace({
      name: 'WS X',
      workspaceKind: buildMockWorkspaceKindInfo({ name: 'vscode' }),
      state: WorkspacesWorkspaceState.WorkspaceStateError,
      podTemplate: mockPodTemplate('jupyter-scipy:v1.0.0'),
    }),
    buildMockWorkspace({
      name: 'WS Y',
      workspaceKind: buildMockWorkspaceKindInfo({ name: 'vscode' }),
      state: WorkspacesWorkspaceState.WorkspaceStateError,
      podTemplate: mockPodTemplate('jupyter-scipy:v2.0.0'),
    }),
  ];
};

describe('Workspaces', () => {
  describe('Basic', () => {
    it('should display the correct number of workspaces for each namespace', () => {
      const { mockDefaultNs, mockKubeflowNs, defaultNsWorkspaces, kubeflowNsWorkspaces } =
        setupMultiNamespaceWorkspaces(5, 10);

      workspaces.visit();
      cy.wait('@getNamespaces');

      navBar.selectNamespace(mockDefaultNs.name);
      cy.wait('@getDefaultNsWorkspaces');
      workspaces.assertWorkspaceCount(defaultNsWorkspaces.length);

      navBar.selectNamespace(mockKubeflowNs.name);
      cy.wait('@getKubeflowNsWorkspaces');
      workspaces.assertWorkspaceCount(kubeflowNsWorkspaces.length);
    });

    it('should display workspace name, state, image, and last activity in each table row', () => {
      const { mockNamespace, mockWorkspaces } = setupSingleNamespaceWorkspaces(
        DEFAULT_NAMESPACE,
        5,
      );

      navigateToNamespace(mockNamespace.name);

      workspaces.assertWorkspaceCount(mockWorkspaces.length);
      workspaces.findWorkspacesTableRows().each((_, index) => {
        workspaces.assertWorkspaceRowName(index, mockWorkspaces[index].name);
        workspaces.assertWorkspaceRowState(index, mockWorkspaces[index].state);
        workspaces.assertWorkspaceRowImage(
          index,
          mockWorkspaces[index].podTemplate.options.imageConfig.current.displayName,
        );
        cy.then(() => {
          workspaces.assertWorkspaceRowLastActivity(
            index,
            formatDistanceToNow(new Date(mockWorkspaces[index].activity.lastActivity), {
              addSuffix: true,
            }),
          );
        });
      });
    });
  });

  describe('Empty state', () => {
    it('should display empty state when no workspaces are available', () => {
      const { mockNamespace } = setupSingleNamespaceWorkspaces(DEFAULT_NAMESPACE, 0);

      navigateToNamespace(mockNamespace.name);

      workspaces.assertWorkspaceCount(0);
      workspaces.assertEmptyStateExists();
    });

    it('should transition from workspaces to empty state when switching namespaces', () => {
      const { mockDefaultNs, mockKubeflowNs, defaultNsWorkspaces } = setupMultiNamespaceWorkspaces(
        5,
        0,
      );

      workspaces.visit();
      cy.wait('@getNamespaces');

      navBar.selectNamespace(mockDefaultNs.name);
      cy.wait('@getDefaultNsWorkspaces');
      workspaces.assertWorkspaceCount(defaultNsWorkspaces.length);
      workspaces.assertEmptyStateNotExists();

      navBar.selectNamespace(mockKubeflowNs.name);
      cy.wait('@getKubeflowNsWorkspaces');
      workspaces.assertWorkspaceCount(0);
      workspaces.assertEmptyStateExists();
    });

    it('should transition from empty state to workspaces when switching namespaces', () => {
      const { mockDefaultNs, mockKubeflowNs, defaultNsWorkspaces } = setupMultiNamespaceWorkspaces(
        5,
        0,
      );

      workspaces.visit();
      cy.wait('@getNamespaces');

      navBar.selectNamespace(mockKubeflowNs.name);
      cy.wait('@getKubeflowNsWorkspaces');
      workspaces.assertWorkspaceCount(0);
      workspaces.assertEmptyStateExists();

      navBar.selectNamespace(mockDefaultNs.name);
      cy.wait('@getDefaultNsWorkspaces');
      workspaces.assertWorkspaceCount(defaultNsWorkspaces.length);
      workspaces.assertEmptyStateNotExists();
    });
  });

  describe('Expand row', () => {
    it('should expand and collapse table row to view workspace details', () => {
      const mockNamespace = buildMockNamespace({ name: DEFAULT_NAMESPACE });
      const mockWorkspaceKind = buildMockWorkspaceKindInfo({ name: 'jupyterlab' });
      const mockWorkspace = buildMockWorkspace({
        name: TEST_WORKSPACE_NAME,
        namespace: mockNamespace.name,
        workspaceKind: mockWorkspaceKind,
        state: WorkspacesWorkspaceState.WorkspaceStateRunning,
      });

      cy.interceptApi(
        'GET /api/:apiVersion/namespaces',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse([mockNamespace]),
      ).as('getNamespaces');
      cy.interceptApi(
        'GET /api/:apiVersion/workspaces/:namespace',
        { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockNamespace.name } },
        mockModArchResponse([mockWorkspace]),
      ).as('getWorkspaces');

      navigateToNamespace(mockNamespace.name);

      // Verify row is initially collapsed
      workspaces.assertExpandedRowNotExists(mockWorkspace.name);
      workspaces.toggleRowExpansion(0);

      // Verify expanded content
      workspaces.assertExpandedRowExists(mockWorkspace.name);
      workspaces.assertExpandedRowContainsText(mockWorkspace.name, 'Home volume');
      workspaces.assertExpandedRowContainsText(mockWorkspace.name, 'Packages');
      workspaces.assertExpandedRowContainsText(mockWorkspace.name, 'Pod config');
      workspaces.assertExpandedRowContainsText(mockWorkspace.name, 'CPU');
      workspaces.assertExpandedRowContainsText(mockWorkspace.name, 'Memory');

      // Collapse the row
      workspaces.toggleRowExpansion(0);
      workspaces.assertExpandedRowNotExists(mockWorkspace.name);
    });

    it('should allow multiple rows to be expanded simultaneously', () => {
      const mockNamespace = buildMockNamespace({ name: DEFAULT_NAMESPACE });
      const workspace1 = buildMockWorkspace({
        name: 'Workspace1',
        state: WorkspacesWorkspaceState.WorkspaceStateRunning,
      });
      const workspace2 = buildMockWorkspace({
        name: 'Workspace2',
        state: WorkspacesWorkspaceState.WorkspaceStateRunning,
      });

      cy.interceptApi(
        'GET /api/:apiVersion/namespaces',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse([mockNamespace]),
      ).as('getNamespaces');
      cy.interceptApi(
        'GET /api/:apiVersion/workspaces/:namespace',
        { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockNamespace.name } },
        mockModArchResponse([workspace1, workspace2]),
      ).as('getWorkspaces');

      navigateToNamespace(mockNamespace.name);

      // Expand first row
      workspaces.toggleRowExpansion(0);
      workspaces.assertExpandedRowExists(workspace1.name);

      // Expand second row
      workspaces.toggleRowExpansion(1);
      workspaces.assertExpandedRowExists(workspace2.name);

      // Both should still be expanded
      workspaces.assertExpandedRowExists(workspace1.name);
      workspaces.assertExpandedRowExists(workspace2.name);
    });
  });

  describe('Pagination', () => {
    it('should navigate through pages of workspaces', () => {
      const { mockNamespace, mockWorkspaces } = setupSingleNamespaceWorkspaces(
        DEFAULT_NAMESPACE,
        25,
      );

      navigateToNamespace(mockNamespace.name);

      // First page
      workspaces.assertWorkspaceCount(DEFAULT_PAGE_SIZE);
      workspaces.assertPaginationExists();
      workspaces.assertWorkspaceRowName(0, mockWorkspaces[0].name);
      workspaces.assertWorkspaceRowName(9, mockWorkspaces[9].name);

      // Second page
      workspaces.goToNextPage();
      workspaces.assertWorkspaceCount(DEFAULT_PAGE_SIZE);
      workspaces.assertWorkspaceRowName(0, mockWorkspaces[10].name);
      workspaces.assertWorkspaceRowName(9, mockWorkspaces[19].name);

      // Third page
      workspaces.goToNextPage();
      workspaces.assertWorkspaceCount(5);
      workspaces.assertWorkspaceRowName(0, mockWorkspaces[20].name);
      workspaces.assertWorkspaceRowName(4, mockWorkspaces[24].name);

      // Back to second page
      workspaces.goToPreviousPage();
      workspaces.assertWorkspaceCount(DEFAULT_PAGE_SIZE);
      workspaces.assertWorkspaceRowName(0, mockWorkspaces[10].name);

      // Back to first page
      workspaces.goToPreviousPage();
      workspaces.assertWorkspaceCount(DEFAULT_PAGE_SIZE);
      workspaces.assertWorkspaceRowName(0, mockWorkspaces[0].name);
      workspaces.assertWorkspaceRowName(9, mockWorkspaces[9].name);
    });

    it('should handle exactly one page of workspaces with disabled controls', () => {
      const { mockNamespace } = setupSingleNamespaceWorkspaces(
        DEFAULT_NAMESPACE,
        DEFAULT_PAGE_SIZE,
      );

      navigateToNamespace(mockNamespace.name);

      workspaces.assertWorkspaceCount(DEFAULT_PAGE_SIZE);
      workspaces.assertPaginationExists();
      workspaces.assertPrevNextDisabled();
    });

    it('should reset pagination when applying filters', () => {
      const { mockNamespace, mockWorkspaces } = setupSingleNamespaceWorkspaces(
        DEFAULT_NAMESPACE,
        25,
      );

      navigateToNamespace(mockNamespace.name);

      workspaces.goToNextPage();
      workspaces.goToNextPage();
      workspaces.assertWorkspaceCount(5);
      workspaces.assertWorkspaceRowName(0, mockWorkspaces[20].name);

      const targetWorkspace = mockWorkspaces[4];

      workspaces.applyFilter({ key: 'name', value: targetWorkspace.name, name: 'Name' });

      workspaces.assertWorkspaceCount(1);
      workspaces.assertWorkspaceRowName(0, targetWorkspace.name);
    });
  });

  describe('Sorting', () => {
    it('should sort workspaces by name', () => {
      const mockNamespace = buildMockNamespace({ name: DEFAULT_NAMESPACE });
      const mockWorkspaceKind = buildMockWorkspaceKindInfo({ name: 'jupyterlab' });
      const mockWorkspaces = [
        buildMockWorkspace({ name: 'zebra-workspace', workspaceKind: mockWorkspaceKind }),
        buildMockWorkspace({ name: 'alpha-workspace', workspaceKind: mockWorkspaceKind }),
        buildMockWorkspace({ name: 'beta-workspace', workspaceKind: mockWorkspaceKind }),
      ];

      cy.interceptApi(
        'GET /api/:apiVersion/namespaces',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse([mockNamespace]),
      ).as('getNamespaces');

      cy.interceptApi(
        'GET /api/:apiVersion/workspaces/:namespace',
        { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockNamespace.name } },
        mockModArchResponse(mockWorkspaces),
      ).as('getWorkspaces');

      navigateToNamespace(mockNamespace.name);

      // Click on Name column header to sort
      workspaces.findColumnHeader('Name').click();

      // Verify ascending order
      workspaces.assertWorkspaceRowName(0, 'alpha-workspace');
      workspaces.assertWorkspaceRowName(1, 'beta-workspace');
      workspaces.assertWorkspaceRowName(2, 'zebra-workspace');

      // Click again for descending order
      workspaces.findColumnHeader('Name').click();

      // Verify descending order
      workspaces.assertWorkspaceRowName(0, 'zebra-workspace');
      workspaces.assertWorkspaceRowName(1, 'beta-workspace');
      workspaces.assertWorkspaceRowName(2, 'alpha-workspace');
    });

    it('should sort workspaces by state', () => {
      const mockNamespace = buildMockNamespace({ name: DEFAULT_NAMESPACE });
      const mockWorkspaceKind = buildMockWorkspaceKindInfo({ name: 'jupyterlab' });
      const mockWorkspaces = [
        buildMockWorkspace({
          name: 'workspace-running',
          workspaceKind: mockWorkspaceKind,
          state: WorkspacesWorkspaceState.WorkspaceStateRunning,
        }),
        buildMockWorkspace({
          name: 'workspace-error',
          workspaceKind: mockWorkspaceKind,
          state: WorkspacesWorkspaceState.WorkspaceStateError,
        }),
        buildMockWorkspace({
          name: 'workspace-paused',
          workspaceKind: mockWorkspaceKind,
          state: WorkspacesWorkspaceState.WorkspaceStatePaused,
        }),
      ];

      cy.interceptApi(
        'GET /api/:apiVersion/namespaces',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse([mockNamespace]),
      ).as('getNamespaces');

      cy.interceptApi(
        'GET /api/:apiVersion/workspaces/:namespace',
        { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockNamespace.name } },
        mockModArchResponse(mockWorkspaces),
      ).as('getWorkspaces');

      navigateToNamespace(mockNamespace.name);

      // Click on State column header to sort
      workspaces.findColumnHeader('State').click();

      // Verify ascending order (Error, Paused, Running alphabetically)
      workspaces.assertWorkspaceRowName(0, 'workspace-error');
      workspaces.assertWorkspaceRowName(1, 'workspace-paused');
      workspaces.assertWorkspaceRowName(2, 'workspace-running');

      // Click again for descending order
      workspaces.findColumnHeader('State').click();

      // Verify descending order
      workspaces.assertWorkspaceRowName(0, 'workspace-running');
      workspaces.assertWorkspaceRowName(1, 'workspace-paused');
      workspaces.assertWorkspaceRowName(2, 'workspace-error');
    });

    it('should sort workspaces by image', () => {
      const mockNamespace = buildMockNamespace({ name: DEFAULT_NAMESPACE });
      const mockWorkspaceKind = buildMockWorkspaceKindInfo({ name: 'jupyterlab' });
      const mockWorkspaces = [
        buildMockWorkspace({
          name: 'workspace-tensorflow',
          workspaceKind: mockWorkspaceKind,
          podTemplate: createMockPodTemplateWithImage('tensorflow:v2.0.0'),
        }),
        buildMockWorkspace({
          name: 'workspace-pytorch',
          workspaceKind: mockWorkspaceKind,
          podTemplate: createMockPodTemplateWithImage('pytorch:v1.5.0'),
        }),
        buildMockWorkspace({
          name: 'workspace-scipy',
          workspaceKind: mockWorkspaceKind,
          podTemplate: createMockPodTemplateWithImage('jupyter-scipy:v1.0.0'),
        }),
      ];

      cy.interceptApi(
        'GET /api/:apiVersion/namespaces',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse([mockNamespace]),
      ).as('getNamespaces');

      cy.interceptApi(
        'GET /api/:apiVersion/workspaces/:namespace',
        { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockNamespace.name } },
        mockModArchResponse(mockWorkspaces),
      ).as('getWorkspaces');

      navigateToNamespace(mockNamespace.name);

      // Click on Image column header to sort
      workspaces.findColumnHeader('Image').click();

      // Verify ascending order
      workspaces.assertWorkspaceRowName(0, 'workspace-scipy');
      workspaces.assertWorkspaceRowName(1, 'workspace-pytorch');
      workspaces.assertWorkspaceRowName(2, 'workspace-tensorflow');

      // Click again for descending order
      workspaces.findColumnHeader('Image').click();

      // Verify descending order
      workspaces.assertWorkspaceRowName(0, 'workspace-tensorflow');
      workspaces.assertWorkspaceRowName(1, 'workspace-pytorch');
      workspaces.assertWorkspaceRowName(2, 'workspace-scipy');
    });
  });

  describe('Filter', () => {
    const filterTestCases = [
      {
        filterType: 'name',
        tests: [
          { value: 'Workspace 1', expectedCount: 1 },
          { value: 'Workspace', expectedCount: 3 },
          { value: 'Unknown', expectedCount: 0 },
        ],
      },
      {
        filterType: 'state',
        tests: [
          { value: 'Running', expectedCount: 2 },
          { value: 'Error', expectedCount: 2 },
          { value: 'Paused', expectedCount: 1 },
          { value: 'Unknown', expectedCount: 0 },
        ],
      },
      {
        filterType: 'kind',
        tests: [
          { value: 'jupyterlab', expectedCount: 3 },
          { value: 'vscode', expectedCount: 2 },
          { value: 'Unknown', expectedCount: 0 },
        ],
      },
      {
        filterType: 'image',
        tests: [
          { value: 'jupyter-scipy:v1.0.0', expectedCount: 3 },
          { value: 'jupyter-scipy:v2.0.0', expectedCount: 2 },
          { value: 'Unknown', expectedCount: 0 },
        ],
      },
    ] as const;

    beforeEach(() => {
      const mockDefaultNs = buildMockNamespace({ name: DEFAULT_NAMESPACE });
      const mockWorkspaces = createFilterTestWorkspaces();

      cy.interceptApi(
        'GET /api/:apiVersion/namespaces',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse([mockDefaultNs]),
      ).as('getNamespaces');
      cy.interceptApi(
        'GET /api/:apiVersion/workspaces/:namespace',
        { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockDefaultNs.name } },
        mockModArchResponse(mockWorkspaces),
      ).as('getWorkspaces');

      navigateToNamespace(mockDefaultNs.name);
    });

    filterTestCases.forEach(({ filterType, tests }) => {
      it(`should filter workspaces by ${filterType}`, () => {
        workspaces.assertWorkspaceCount(TOTAL_FILTER_TEST_WORKSPACES);

        tests.forEach(({ value, expectedCount }) => {
          workspaces.applyFilter({
            key: filterType,
            value,
            name: filterType.charAt(0).toUpperCase() + filterType.slice(1),
          });
          workspaces.assertWorkspaceCount(expectedCount);
        });
      });
    });

    it('should apply multiple filters simultaneously', () => {
      workspaces.applyFilter({ key: 'name', value: 'Workspace', name: 'Name' });
      workspaces.applyFilter({ key: 'image', value: 'jupyter-scipy:v1.0.0', name: 'Image' });

      workspaces.assertWorkspaceCount(2);
    });

    it('should remove individual filters from a multi-filter selection', () => {
      workspaces.applyFilter({ key: 'name', value: 'Workspace', name: 'Name' });
      workspaces.applyFilter({ key: 'image', value: 'jupyter-scipy:v1.0.0', name: 'Image' });

      workspaces.assertWorkspaceCount(2);
      workspaces.removeFilter('Image');
      workspaces.assertWorkspaceCount(3);
    });

    it('should clear all filters and display all workspaces', () => {
      workspaces.assertWorkspaceCount(TOTAL_FILTER_TEST_WORKSPACES);
      workspaces.applyFilter({ key: 'name', value: 'Workspace', name: 'Name' });
      workspaces.applyFilter({ key: 'image', value: 'jupyter-scipy:v1.0.0', name: 'Image' });

      workspaces.assertWorkspaceCount(2);
      workspaces.removeAllFilters();
      workspaces.assertWorkspaceCount(TOTAL_FILTER_TEST_WORKSPACES);
    });

    it('should display empty state when filters return no results', () => {
      workspaces.applyFilter({ key: 'name', value: 'NonExistentWorkspace', name: 'Name' });

      workspaces.assertWorkspaceCount(0);
      workspaces.assertEmptyStateExists();
    });
  });

  describe('Actions', () => {
    const setupWorkspaceActionTest = (
      workspaceName: string,
      state: WorkspacesWorkspaceState,
      namespaceName = DEFAULT_NAMESPACE,
    ) => {
      const mockNamespace = buildMockNamespace({ name: namespaceName });
      const mockWorkspaces = [buildMockWorkspace({ name: workspaceName, state })];

      cy.interceptApi(
        'GET /api/:apiVersion/namespaces',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse([mockNamespace]),
      ).as('getNamespaces');

      cy.interceptApi(
        'GET /api/:apiVersion/workspaces/:namespace',
        { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockNamespace.name } },
        mockModArchResponse(mockWorkspaces),
      ).as('getWorkspaces');

      navigateToNamespace(mockNamespace.name);

      return { mockNamespace, mockWorkspaces };
    };

    describe('Delete', () => {
      const WORKSPACE_A = 'WorkspaceA';
      const WORKSPACE_B = 'WorkspaceB';

      beforeEach(() => {
        const mockNamespace = buildMockNamespace({ name: DEFAULT_NAMESPACE });
        const mockWorkspaces = [
          buildMockWorkspace({ name: WORKSPACE_A }),
          buildMockWorkspace({ name: WORKSPACE_B }),
        ];

        cy.interceptApi(
          'GET /api/:apiVersion/namespaces',
          { path: { apiVersion: NOTEBOOKS_API_VERSION } },
          mockModArchResponse([mockNamespace]),
        ).as('getNamespaces');
        cy.interceptApi(
          'GET /api/:apiVersion/workspaces/:namespace',
          { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockNamespace.name } },
          mockModArchResponse(mockWorkspaces),
        ).as('getWorkspaces');
        cy.interceptApi(
          'DELETE /api/:apiVersion/workspaces/:namespace/:workspaceName',
          {
            path: {
              apiVersion: NOTEBOOKS_API_VERSION,
              namespace: mockNamespace.name,
              workspaceName: WORKSPACE_A,
            },
          },
          undefined,
        ).as('deleteWorkspaceA');

        navigateToNamespace(mockNamespace.name);
      });

      it('should successfully delete a workspace with correct confirmation', () => {
        workspaces.findAction({ action: 'delete', workspaceName: WORKSPACE_A }).click();
        deleteModal.findConfirmationInput().type(WORKSPACE_A);
        deleteModal.findSubmitButton().click();

        cy.wait('@deleteWorkspaceA').then((interception) => {
          expect(interception.response?.statusCode).to.be.equal(200);
        });

        deleteModal.assertModalNotExists();
      });

      it('should cancel workspace deletion when cancel button is clicked', () => {
        workspaces.findAction({ action: 'delete', workspaceName: WORKSPACE_A }).click();
        deleteModal.findCancelButton().click();
        deleteModal.assertModalNotExists();
        cy.get('@deleteWorkspaceA.all').should('have.length', 0);
      });

      it('should disable delete button when confirmation input is incorrect', () => {
        workspaces.findAction({ action: 'delete', workspaceName: WORKSPACE_A }).click();
        deleteModal.findConfirmationInput().type(WORKSPACE_B);
        deleteModal.assertSubmitButtonDisabled();
      });

      it('should enable delete button after correcting confirmation input', () => {
        workspaces.findAction({ action: 'delete', workspaceName: WORKSPACE_A }).click();
        deleteModal.findConfirmationInput().type(WORKSPACE_B);
        deleteModal.assertSubmitButtonDisabled();

        deleteModal.findConfirmationInput().clear().type(WORKSPACE_A);
        deleteModal.assertSubmitButtonEnabled();
        deleteModal.findSubmitButton().click();

        cy.wait('@deleteWorkspaceA').then((interception) => {
          expect(interception.response?.statusCode).to.be.equal(200);
        });

        deleteModal.assertModalNotExists();
      });

      it('should display error in modal when delete fails', () => {
        cy.interceptApi(
          'DELETE /api/:apiVersion/workspaces/:namespace/:workspaceName',
          {
            path: {
              apiVersion: NOTEBOOKS_API_VERSION,
              namespace: DEFAULT_NAMESPACE,
              workspaceName: WORKSPACE_A,
            },
          },
          {
            error: {
              code: '500',
              message: 'Failed to delete workspace',
            },
          },
        ).as('deleteWorkspaceError');

        workspaces.findAction({ action: 'delete', workspaceName: WORKSPACE_A }).click();
        deleteModal.findConfirmationInput().type(WORKSPACE_A);
        deleteModal.findSubmitButton().click();

        cy.wait('@deleteWorkspaceError');

        deleteModal.assertModalExists();
        deleteModal.assertErrorAlertContainsMessage('Error: Failed to delete workspace');
      });
    });

    describe('Start', () => {
      beforeEach(() => {
        const { mockNamespace } = setupWorkspaceActionTest(
          TEST_WORKSPACE_NAME,
          WorkspacesWorkspaceState.WorkspaceStatePaused,
        );

        cy.interceptApi(
          'POST /api/:apiVersion/workspaces/:namespace/:workspaceName/actions/pause',
          {
            path: {
              apiVersion: NOTEBOOKS_API_VERSION,
              namespace: mockNamespace.name,
              workspaceName: TEST_WORKSPACE_NAME,
            },
          },
          mockModArchResponse(buildMockActionsWorkspaceActionPause({ paused: false })),
        ).as('startWorkspace');
      });

      it('should successfully start a paused workspace', () => {
        workspaces.findAction({ action: 'start', workspaceName: TEST_WORKSPACE_NAME }).click();
        startModal.findStartButton().click();

        cy.wait('@startWorkspace').then((interception) => {
          expect(interception.response?.statusCode).to.be.equal(200);
        });

        startModal.assertModalNotExists();
      });

      it('should cancel workspace start when cancel button is clicked', () => {
        workspaces.findAction({ action: 'start', workspaceName: TEST_WORKSPACE_NAME }).click();
        startModal.findCancelButton().click();
        startModal.assertModalNotExists();
        cy.get('@startWorkspace.all').should('have.length', 0);
      });

      it('should display error in modal when start fails', () => {
        cy.interceptApi(
          'POST /api/:apiVersion/workspaces/:namespace/:workspaceName/actions/pause',
          {
            path: {
              apiVersion: NOTEBOOKS_API_VERSION,
              namespace: DEFAULT_NAMESPACE,
              workspaceName: TEST_WORKSPACE_NAME,
            },
          },
          {
            error: {
              code: '500',
              message: 'Failed to start workspace',
            },
          },
        ).as('startWorkspaceError');

        workspaces.findAction({ action: 'start', workspaceName: TEST_WORKSPACE_NAME }).click();
        startModal.findStartButton().click();

        cy.wait('@startWorkspaceError');

        startModal.assertModalExists();
        startModal.assertErrorAlertContainsMessage('Error: Failed to start workspace');
      });
    });

    describe('Stop', () => {
      beforeEach(() => {
        const { mockNamespace } = setupWorkspaceActionTest(
          TEST_WORKSPACE_NAME,
          WorkspacesWorkspaceState.WorkspaceStateRunning,
        );

        cy.interceptApi(
          'POST /api/:apiVersion/workspaces/:namespace/:workspaceName/actions/pause',
          {
            path: {
              apiVersion: NOTEBOOKS_API_VERSION,
              namespace: mockNamespace.name,
              workspaceName: TEST_WORKSPACE_NAME,
            },
          },
          mockModArchResponse(buildMockActionsWorkspaceActionPause({ paused: true })),
        ).as('stopWorkspace');
      });

      it('should successfully stop a running workspace', () => {
        workspaces.findAction({ action: 'stop', workspaceName: TEST_WORKSPACE_NAME }).click();
        stopModal.findStopButton().click();

        cy.wait('@stopWorkspace').then((interception) => {
          expect(interception.response?.statusCode).to.be.equal(200);
        });

        stopModal.assertModalNotExists();
      });

      it('should cancel workspace stop when cancel button is clicked', () => {
        workspaces.findAction({ action: 'stop', workspaceName: TEST_WORKSPACE_NAME }).click();
        stopModal.findCancelButton().click();
        stopModal.assertModalNotExists();
        cy.get('@stopWorkspace.all').should('have.length', 0);
      });

      it('should display error in modal when stop fails', () => {
        cy.interceptApi(
          'POST /api/:apiVersion/workspaces/:namespace/:workspaceName/actions/pause',
          {
            path: {
              apiVersion: NOTEBOOKS_API_VERSION,
              namespace: DEFAULT_NAMESPACE,
              workspaceName: TEST_WORKSPACE_NAME,
            },
          },
          {
            error: {
              code: '500',
              message: 'Failed to stop workspace',
            },
          },
        ).as('stopWorkspaceError');

        workspaces.findAction({ action: 'stop', workspaceName: TEST_WORKSPACE_NAME }).click();
        stopModal.findStopButton().click();

        cy.wait('@stopWorkspaceError');

        stopModal.assertModalExists();
        stopModal.assertErrorAlertContainsMessage('Error: Failed to stop workspace');
      });
    });

    describe('Details', () => {
      beforeEach(() => {
        setupWorkspaceActionTest(
          TEST_WORKSPACE_NAME,
          WorkspacesWorkspaceState.WorkspaceStateRunning,
        );
      });

      it('should open workspace details drawer from actions menu', () => {
        workspaceDetailsDrawer.assertDrawerNotExists();

        workspaces
          .findAction({ action: 'viewDetails', workspaceName: TEST_WORKSPACE_NAME })
          .click();

        workspaceDetailsDrawer.assertDrawerExists();
        workspaceDetailsDrawer.assertDrawerTitle(TEST_WORKSPACE_NAME);
      });

      it('should close workspace details drawer', () => {
        workspaces
          .findAction({ action: 'viewDetails', workspaceName: TEST_WORKSPACE_NAME })
          .click();
        workspaceDetailsDrawer.assertDrawerExists();

        workspaceDetailsDrawer.findCloseButton().click();

        workspaceDetailsDrawer.assertDrawerNotExists();
      });

      it('should display Overview tab by default with workspace information', () => {
        workspaces
          .findAction({ action: 'viewDetails', workspaceName: TEST_WORKSPACE_NAME })
          .click();

        workspaceDetailsDrawer.assertOverviewTabSelected(true);
        workspaceDetailsDrawer.assertOverviewTabContentVisible();
        workspaceDetailsDrawer.assertOverviewTabContentContainsText('Name');
        workspaceDetailsDrawer.assertOverviewTabContentContainsText('Kind');
        workspaceDetailsDrawer.assertOverviewTabContentContainsText('Labels');
        workspaceDetailsDrawer.assertOverviewTabContentContainsText('Pod config');
      });

      it('should switch to Activity tab and display activity information', () => {
        workspaces
          .findAction({ action: 'viewDetails', workspaceName: TEST_WORKSPACE_NAME })
          .click();

        workspaceDetailsDrawer.assertOverviewTabSelected(true);
        workspaceDetailsDrawer.assertActivityTabContentNotVisible();

        workspaceDetailsDrawer.findActivityTab().click();

        workspaceDetailsDrawer.assertActivityTabSelected(true);
        workspaceDetailsDrawer.assertOverviewTabSelected(false);
        workspaceDetailsDrawer.assertActivityTabContentVisible();
        workspaceDetailsDrawer.assertActivityTabContentContainsText('Last activity');
        workspaceDetailsDrawer.assertActivityTabContentContainsText('Last update');
        workspaceDetailsDrawer.assertActivityTabContentContainsText('Pause time');
        workspaceDetailsDrawer.assertActivityTabContentContainsText('Pending restart');
      });

      it('should navigate back to Overview tab from Activity tab', () => {
        workspaces
          .findAction({ action: 'viewDetails', workspaceName: TEST_WORKSPACE_NAME })
          .click();

        workspaceDetailsDrawer.findActivityTab().click();
        workspaceDetailsDrawer.assertActivityTabSelected(true);

        workspaceDetailsDrawer.findOverviewTab().click();

        workspaceDetailsDrawer.assertOverviewTabAriaSelected(true);
        workspaceDetailsDrawer.assertActivityTabAriaSelected(false);
        workspaceDetailsDrawer.assertOverviewTabContentVisible();
        workspaceDetailsDrawer.assertActivityTabContentNotVisible();
      });

      it('should update drawer content when switching between workspaces', () => {
        const workspace2Name = 'Workspace2';
        const mockNamespace = buildMockNamespace({ name: DEFAULT_NAMESPACE });
        const mockWorkspaces = [
          buildMockWorkspace({
            name: TEST_WORKSPACE_NAME,
            state: WorkspacesWorkspaceState.WorkspaceStateRunning,
          }),
          buildMockWorkspace({
            name: workspace2Name,
            state: WorkspacesWorkspaceState.WorkspaceStatePaused,
          }),
        ];

        cy.interceptApi(
          'GET /api/:apiVersion/namespaces',
          { path: { apiVersion: NOTEBOOKS_API_VERSION } },
          mockModArchResponse([mockNamespace]),
        ).as('getNamespaces');
        cy.interceptApi(
          'GET /api/:apiVersion/workspaces/:namespace',
          { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockNamespace.name } },
          mockModArchResponse(mockWorkspaces),
        ).as('getWorkspaces');

        navigateToNamespace(mockNamespace.name);

        // Open first workspace details
        workspaces
          .findAction({ action: 'viewDetails', workspaceName: TEST_WORKSPACE_NAME })
          .click();
        workspaceDetailsDrawer.assertDrawerTitle(TEST_WORKSPACE_NAME);
        workspaceDetailsDrawer.findCloseButton().click();

        // Open second workspace details
        workspaces.findAction({ action: 'viewDetails', workspaceName: workspace2Name }).click();
        workspaceDetailsDrawer.assertDrawerTitle(workspace2Name);
      });
    });
  });
});
