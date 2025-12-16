import { mockModArchResponse } from 'mod-arch-core';
import {
  workspaceKinds,
  workspaceKindDetailsDrawer,
} from '~/__tests__/cypress/cypress/pages/workspaceKinds/workspaceKinds';
import { buildMockWorkspaceKind, buildMockNamespace } from '~/shared/mock/mockBuilder';
import { NOTEBOOKS_API_VERSION } from '~/__tests__/cypress/cypress/support/commands/api';
import type { WorkspacekindsWorkspaceKind } from '~/generated/data-contracts';
import { createWorkspaceKind } from '~/__tests__/cypress/cypress/pages/workspaceKinds/createWorkspaceKind';
import { editWorkspaceKind } from '~/__tests__/cypress/cypress/pages/workspaceKinds/editWorkspaceKind';

const DEFAULT_NAMESPACE = 'default';
const TOTAL_FILTER_TEST_WORKSPACEKINDS = 6;
const DEFAULT_PAGE_SIZE = 10;

type WorkspaceKindsSetup = {
  mockWorkspaceKinds: WorkspacekindsWorkspaceKind[];
};

const setupWorkspaceKinds = (count: number): WorkspaceKindsSetup => {
  const mockWorkspaceKinds = Array.from({ length: count }, (_, index) =>
    buildMockWorkspaceKind({
      name: `workspace-kind-${index}`,
    }),
  );

  const mockNamespace = buildMockNamespace({ name: DEFAULT_NAMESPACE });

  cy.interceptApi(
    'GET /api/:apiVersion/namespaces',
    { path: { apiVersion: NOTEBOOKS_API_VERSION } },
    mockModArchResponse([mockNamespace]),
  ).as('getNamespaces');

  cy.interceptApi(
    'GET /api/:apiVersion/workspacekinds',
    { path: { apiVersion: NOTEBOOKS_API_VERSION } },
    mockModArchResponse(mockWorkspaceKinds),
  ).as('getWorkspaceKinds');

  cy.interceptApi(
    'GET /api/:apiVersion/workspaces/:namespace',
    { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockNamespace.name } },
    mockModArchResponse([]),
  ).as('getWorkspaces');

  cy.interceptApi(
    'GET /api/:apiVersion/workspaces',
    { path: { apiVersion: NOTEBOOKS_API_VERSION } },
    mockModArchResponse([]),
  ).as('getAllWorkspaces');

  return { mockWorkspaceKinds };
};

const createFilterTestWorkspaceKinds = (): WorkspacekindsWorkspaceKind[] => [
  buildMockWorkspaceKind({
    name: 'jupyterlab',
    displayName: 'JupyterLab',
    description: 'A workspace for JupyterLab notebooks',
    deprecated: false,
  }),
  buildMockWorkspaceKind({
    name: 'vscode',
    displayName: 'VS Code',
    description: 'A workspace for VS Code development',
    deprecated: false,
  }),
  buildMockWorkspaceKind({
    name: 'r-studio',
    displayName: 'RStudio',
    description: 'A workspace for RStudio statistical computing',
    deprecated: false,
  }),
  buildMockWorkspaceKind({
    name: 'old-jupyterlab',
    displayName: 'Old JupyterLab',
    description: 'Legacy JupyterLab workspace kind',
    deprecated: true,
    deprecationMessage: 'This workspace kind is deprecated. Use jupyterlab instead.',
  }),
  buildMockWorkspaceKind({
    name: 'legacy-notebook',
    displayName: 'Legacy Notebook',
    description: 'Old notebook workspace kind',
    deprecated: true,
    deprecationMessage: 'This workspace kind is no longer supported.',
  }),
  buildMockWorkspaceKind({
    name: 'tensorflow',
    displayName: 'TensorFlow',
    description: 'A workspace optimized for TensorFlow machine learning',
    deprecated: false,
  }),
];

const visitWorkspaceKinds = () => {
  workspaceKinds.visit();
  cy.wait('@getWorkspaceKinds');
};

describe('WorkspaceKinds', () => {
  describe('Basic', () => {
    it('should display the correct number of workspace kinds', () => {
      const { mockWorkspaceKinds } = setupWorkspaceKinds(5);

      visitWorkspaceKinds();

      workspaceKinds.assertWorkspaceKindCount(mockWorkspaceKinds.length);
    });

    it('should display workspace kind name, description, status, and workspace count in each table row', () => {
      const { mockWorkspaceKinds } = setupWorkspaceKinds(3);

      cy.interceptApi(
        'GET /api/:apiVersion/workspaces',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse([]),
      ).as('getAllWorkspaces');

      visitWorkspaceKinds();

      workspaceKinds.assertWorkspaceKindCount(mockWorkspaceKinds.length);
      workspaceKinds.findWorkspaceKindsTableRows().each((_, index) => {
        workspaceKinds.assertWorkspaceKindRowName(index, mockWorkspaceKinds[index].name);
        workspaceKinds.assertWorkspaceKindRowDescription(
          index,
          mockWorkspaceKinds[index].description,
        );
        workspaceKinds.assertWorkspaceKindRowStatus(index, 'Active');
        workspaceKinds.assertWorkspaceKindRowWorkspaceCount(index, 10);
      });
    });

    it('should display error icon when loading workspace counts fails', () => {
      const mockNamespace = buildMockNamespace({ name: DEFAULT_NAMESPACE });
      const mockWorkspaceKind = buildMockWorkspaceKind({ name: 'test-kind' });

      cy.interceptApi(
        'GET /api/:apiVersion/namespaces',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse([mockNamespace]),
      ).as('getNamespaces');

      cy.interceptApi(
        'GET /api/:apiVersion/workspacekinds',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse([mockWorkspaceKind]),
      ).as('getWorkspaceKinds');

      cy.interceptApi(
        'GET /api/:apiVersion/workspaces/:namespace',
        { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockNamespace.name } },
        mockModArchResponse([]),
      ).as('getWorkspaces');

      cy.interceptApi(
        'GET /api/:apiVersion/workspaces',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        {
          error: {
            code: '500',
            message: 'Failed to load workspace counts',
          },
        },
      ).as('getAllWorkspacesError');

      visitWorkspaceKinds();

      cy.wait('@getAllWorkspacesError');

      workspaceKinds.assertWorkspaceCountErrorPopoverExists(0);
    });

    it('should display deprecated status for deprecated workspace kinds', () => {
      const mockWorkspaceKind = buildMockWorkspaceKind({
        name: 'deprecated-kind',
        deprecated: true,
        deprecationMessage: 'This kind is deprecated',
      });

      const mockNamespace = buildMockNamespace({ name: DEFAULT_NAMESPACE });

      cy.interceptApi(
        'GET /api/:apiVersion/namespaces',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse([mockNamespace]),
      ).as('getNamespaces');

      cy.interceptApi(
        'GET /api/:apiVersion/workspacekinds',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse([mockWorkspaceKind]),
      ).as('getWorkspaceKinds');

      cy.interceptApi(
        'GET /api/:apiVersion/workspaces/:namespace',
        { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockNamespace.name } },
        mockModArchResponse([]),
      ).as('getWorkspaces');

      cy.interceptApi(
        'GET /api/:apiVersion/workspaces',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse([]),
      ).as('getAllWorkspaces');

      visitWorkspaceKinds();

      workspaceKinds.assertWorkspaceKindRowStatus(0, 'Deprecated');
    });

    it('should display correct workspace count when workspaces exist', () => {
      const mockWorkspaceKind = buildMockWorkspaceKind({
        name: 'jupyterlab',
        clusterMetrics: {
          workspacesCount: 5,
        },
      });

      const mockNamespace = buildMockNamespace({ name: DEFAULT_NAMESPACE });

      cy.interceptApi(
        'GET /api/:apiVersion/namespaces',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse([mockNamespace]),
      ).as('getNamespaces');

      cy.interceptApi(
        'GET /api/:apiVersion/workspacekinds',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse([mockWorkspaceKind]),
      ).as('getWorkspaceKinds');

      cy.interceptApi(
        'GET /api/:apiVersion/workspaces',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse([]),
      ).as('getAllWorkspaces');

      cy.interceptApi(
        'GET /api/:apiVersion/workspaces/:namespace',
        { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockNamespace.name } },
        mockModArchResponse([]),
      ).as('getWorkspaces');

      visitWorkspaceKinds();

      workspaceKinds.assertWorkspaceKindRowWorkspaceCount(0, 5);
    });

    it('should navigate to create workspace kind page when create button is clicked', () => {
      setupWorkspaceKinds(1);

      visitWorkspaceKinds();

      workspaceKinds.findCreateWorkspaceKindButton().click();
      createWorkspaceKind.verifyPageURL();
    });
  });

  describe('Empty state', () => {
    it('should display empty state when no workspace kinds are available', () => {
      setupWorkspaceKinds(0);

      visitWorkspaceKinds();

      workspaceKinds.assertWorkspaceKindCount(0);
      workspaceKinds.assertEmptyStateVisible();
    });
  });

  describe('Filter', () => {
    beforeEach(() => {
      const mockWorkspaceKinds = createFilterTestWorkspaceKinds();
      const mockNamespace = buildMockNamespace({ name: DEFAULT_NAMESPACE });

      cy.interceptApi(
        'GET /api/:apiVersion/namespaces',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse([mockNamespace]),
      ).as('getNamespaces');

      cy.interceptApi(
        'GET /api/:apiVersion/workspacekinds',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse(mockWorkspaceKinds),
      ).as('getWorkspaceKinds');

      cy.interceptApi(
        'GET /api/:apiVersion/workspaces/:namespace',
        { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockNamespace.name } },
        mockModArchResponse([]),
      ).as('getWorkspaces');

      cy.interceptApi(
        'GET /api/:apiVersion/workspaces',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse([]),
      ).as('getAllWorkspaces');

      visitWorkspaceKinds();
    });

    it('should filter workspace kinds by name', () => {
      workspaceKinds.assertWorkspaceKindCount(TOTAL_FILTER_TEST_WORKSPACEKINDS);

      workspaceKinds.applyNameFilter('jupyterlab');
      workspaceKinds.assertWorkspaceKindCount(2);

      workspaceKinds.clearAllFilters();
      workspaceKinds.applyNameFilter('vscode');
      workspaceKinds.assertWorkspaceKindCount(1);

      workspaceKinds.clearAllFilters();
      workspaceKinds.applyNameFilter('nonexistent');
      workspaceKinds.assertWorkspaceKindCount(0);
      workspaceKinds.assertEmptyStateVisible();
    });

    it('should filter workspace kinds by description', () => {
      workspaceKinds.assertWorkspaceKindCount(TOTAL_FILTER_TEST_WORKSPACEKINDS);

      workspaceKinds.applyDescriptionFilter('JupyterLab');
      workspaceKinds.assertWorkspaceKindCount(2);

      workspaceKinds.clearAllFilters();
      workspaceKinds.applyDescriptionFilter('machine learning');
      workspaceKinds.assertWorkspaceKindCount(1);

      workspaceKinds.clearAllFilters();
      workspaceKinds.applyDescriptionFilter('nonexistent description');
      workspaceKinds.assertWorkspaceKindCount(0);
      workspaceKinds.assertEmptyStateVisible();
    });

    it('should filter workspace kinds by status', () => {
      workspaceKinds.assertWorkspaceKindCount(TOTAL_FILTER_TEST_WORKSPACEKINDS);

      workspaceKinds.applyStatusFilter('Active');
      workspaceKinds.assertWorkspaceKindCount(4);

      workspaceKinds.clearAllFilters();
      workspaceKinds.applyStatusFilter('Deprecated');
      workspaceKinds.assertWorkspaceKindCount(2);
    });

    it('should apply multiple filters simultaneously', () => {
      workspaceKinds.applyNameFilter('jupyterlab');
      workspaceKinds.assertWorkspaceKindCount(2);

      workspaceKinds.applyStatusFilter('Active');
      workspaceKinds.assertWorkspaceKindCount(1);
    });

    it('should remove individual filters from a multi-filter selection', () => {
      workspaceKinds.applyNameFilter('jupyterlab');
      workspaceKinds.applyStatusFilter('Active');

      workspaceKinds.assertWorkspaceKindCount(1);

      workspaceKinds.removeFilter('Status');
      workspaceKinds.assertWorkspaceKindCount(2);
    });

    it('should clear all filters and display all workspace kinds', () => {
      workspaceKinds.assertWorkspaceKindCount(TOTAL_FILTER_TEST_WORKSPACEKINDS);

      workspaceKinds.applyNameFilter('jupyterlab');
      workspaceKinds.applyStatusFilter('Active');

      workspaceKinds.assertWorkspaceKindCount(1);

      workspaceKinds.clearAllFilters();
      workspaceKinds.assertWorkspaceKindCount(TOTAL_FILTER_TEST_WORKSPACEKINDS);
    });

    it('should display empty state when filters return no results', () => {
      workspaceKinds.applyNameFilter('NonExistentWorkspaceKind');

      workspaceKinds.assertWorkspaceKindCount(0);
      workspaceKinds.assertEmptyStateVisible();
    });
  });

  describe('Sorting', () => {
    it('should sort workspace kinds by name', () => {
      const mockWorkspaceKinds = [
        buildMockWorkspaceKind({ name: 'zebra-kind', displayName: 'Zebra' }),
        buildMockWorkspaceKind({ name: 'alpha-kind', displayName: 'Alpha' }),
        buildMockWorkspaceKind({ name: 'beta-kind', displayName: 'Beta' }),
      ];

      const mockNamespace = buildMockNamespace({ name: DEFAULT_NAMESPACE });

      cy.interceptApi(
        'GET /api/:apiVersion/namespaces',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse([mockNamespace]),
      ).as('getNamespaces');

      cy.interceptApi(
        'GET /api/:apiVersion/workspacekinds',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse(mockWorkspaceKinds),
      ).as('getWorkspaceKinds');

      cy.interceptApi(
        'GET /api/:apiVersion/workspaces/:namespace',
        { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockNamespace.name } },
        mockModArchResponse([]),
      ).as('getWorkspaces');

      cy.interceptApi(
        'GET /api/:apiVersion/workspaces',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse([]),
      ).as('getAllWorkspaces');

      visitWorkspaceKinds();

      // Click on Name column header to sort
      workspaceKinds.findColumnHeader('Name').click();

      // Verify ascending order
      workspaceKinds.assertWorkspaceKindRowName(0, 'alpha-kind');
      workspaceKinds.assertWorkspaceKindRowName(1, 'beta-kind');
      workspaceKinds.assertWorkspaceKindRowName(2, 'zebra-kind');

      // Click again for descending order
      workspaceKinds.findColumnHeader('Name').click();

      // Verify descending order
      workspaceKinds.assertWorkspaceKindRowName(0, 'zebra-kind');
      workspaceKinds.assertWorkspaceKindRowName(1, 'beta-kind');
      workspaceKinds.assertWorkspaceKindRowName(2, 'alpha-kind');
    });

    it('should sort workspace kinds by status', () => {
      const mockWorkspaceKinds = [
        buildMockWorkspaceKind({ name: 'active-kind-1', deprecated: false }),
        buildMockWorkspaceKind({ name: 'deprecated-kind', deprecated: true }),
        buildMockWorkspaceKind({ name: 'active-kind-2', deprecated: false }),
      ];

      const mockNamespace = buildMockNamespace({ name: DEFAULT_NAMESPACE });

      cy.interceptApi(
        'GET /api/:apiVersion/namespaces',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse([mockNamespace]),
      ).as('getNamespaces');

      cy.interceptApi(
        'GET /api/:apiVersion/workspacekinds',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse(mockWorkspaceKinds),
      ).as('getWorkspaceKinds');

      cy.interceptApi(
        'GET /api/:apiVersion/workspaces/:namespace',
        { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockNamespace.name } },
        mockModArchResponse([]),
      ).as('getWorkspaces');

      cy.interceptApi(
        'GET /api/:apiVersion/workspaces',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse([]),
      ).as('getAllWorkspaces');

      visitWorkspaceKinds();

      // Click on Status column header to sort
      workspaceKinds.findColumnHeader('Status').click();

      // Verify that active kinds come first (false < true)
      workspaceKinds.assertWorkspaceKindRowName(0, 'active-kind-1');
      workspaceKinds.assertWorkspaceKindRowName(1, 'active-kind-2');
      workspaceKinds.assertWorkspaceKindRowName(2, 'deprecated-kind');

      // Click again for descending order
      workspaceKinds.findColumnHeader('Status').click();

      // Verify that deprecated comes first
      workspaceKinds.assertWorkspaceKindRowName(0, 'deprecated-kind');
    });
  });

  describe('Pagination', () => {
    it('should navigate through pages of workspace kinds', () => {
      const { mockWorkspaceKinds } = setupWorkspaceKinds(25);

      visitWorkspaceKinds();

      // First page
      workspaceKinds.assertWorkspaceKindCount(DEFAULT_PAGE_SIZE);
      workspaceKinds.assertPaginationExists();
      workspaceKinds.assertWorkspaceKindRowName(0, mockWorkspaceKinds[0].name);
      workspaceKinds.assertWorkspaceKindRowName(9, mockWorkspaceKinds[9].name);
      workspaceKinds.assertPaginationRange({ firstItem: 1, lastItem: 10, totalItems: 25 });

      // Second page
      workspaceKinds.goToNextPage();
      workspaceKinds.assertWorkspaceKindCount(DEFAULT_PAGE_SIZE);
      workspaceKinds.assertWorkspaceKindRowName(0, mockWorkspaceKinds[10].name);
      workspaceKinds.assertWorkspaceKindRowName(9, mockWorkspaceKinds[19].name);
      workspaceKinds.assertPaginationRange({ firstItem: 11, lastItem: 20, totalItems: 25 });

      // Third page
      workspaceKinds.goToNextPage();
      workspaceKinds.assertWorkspaceKindCount(5);
      workspaceKinds.assertWorkspaceKindRowName(0, mockWorkspaceKinds[20].name);
      workspaceKinds.assertWorkspaceKindRowName(4, mockWorkspaceKinds[24].name);
      workspaceKinds.assertPaginationRange({ firstItem: 21, lastItem: 25, totalItems: 25 });

      // Back to second page
      workspaceKinds.goToPreviousPage();
      workspaceKinds.assertWorkspaceKindCount(DEFAULT_PAGE_SIZE);
      workspaceKinds.assertWorkspaceKindRowName(0, mockWorkspaceKinds[10].name);
      workspaceKinds.assertPaginationRange({ firstItem: 11, lastItem: 20, totalItems: 25 });

      // Back to first page
      workspaceKinds.goToPreviousPage();
      workspaceKinds.assertWorkspaceKindCount(DEFAULT_PAGE_SIZE);
      workspaceKinds.assertWorkspaceKindRowName(0, mockWorkspaceKinds[0].name);
      workspaceKinds.assertWorkspaceKindRowName(9, mockWorkspaceKinds[9].name);
      workspaceKinds.assertPaginationRange({ firstItem: 1, lastItem: 10, totalItems: 25 });
    });

    it('should handle exactly one page of workspace kinds with disabled controls', () => {
      setupWorkspaceKinds(DEFAULT_PAGE_SIZE);

      visitWorkspaceKinds();

      workspaceKinds.assertWorkspaceKindCount(DEFAULT_PAGE_SIZE);
      workspaceKinds.assertPaginationExists();
      workspaceKinds.assertPrevNextDisabled();
      workspaceKinds.assertPaginationRange({ firstItem: 1, lastItem: 10, totalItems: 10 });
    });

    it('should reset pagination when applying filters', () => {
      const { mockWorkspaceKinds } = setupWorkspaceKinds(25);

      visitWorkspaceKinds();

      // Navigate to page 3
      workspaceKinds.goToNextPage();
      workspaceKinds.goToNextPage();
      workspaceKinds.assertWorkspaceKindCount(5);
      workspaceKinds.assertWorkspaceKindRowName(0, mockWorkspaceKinds[20].name);

      const targetWorkspaceKind = mockWorkspaceKinds[4];
      workspaceKinds.applyNameFilter(targetWorkspaceKind.name);

      workspaceKinds.assertWorkspaceKindCount(1);
      workspaceKinds.assertWorkspaceKindRowName(0, targetWorkspaceKind.name);
      workspaceKinds.assertPaginationRange({ firstItem: 1, lastItem: 1, totalItems: 1 });
    });

    it('should update pagination count when filtering', () => {
      const { mockWorkspaceKinds } = setupWorkspaceKinds(11);

      visitWorkspaceKinds();

      // Navigate to page 2
      workspaceKinds.goToNextPage();
      workspaceKinds.assertWorkspaceKindCount(1);
      workspaceKinds.assertWorkspaceKindRowName(0, mockWorkspaceKinds[10].name);

      const targetWorkspaceKind = mockWorkspaceKinds[0];
      workspaceKinds.applyNameFilter(targetWorkspaceKind.name);

      workspaceKinds.assertWorkspaceKindCount(1);
      workspaceKinds.assertWorkspaceKindRowName(0, targetWorkspaceKind.name);
      workspaceKinds.assertPaginationRange({ firstItem: 1, lastItem: 1, totalItems: 1 });
    });

    it('should show correct pagination range when filter returns multiple results', () => {
      setupWorkspaceKinds(25);

      visitWorkspaceKinds();

      workspaceKinds.assertWorkspaceKindCount(DEFAULT_PAGE_SIZE);
      workspaceKinds.assertPaginationRange({ firstItem: 1, lastItem: 10, totalItems: 25 });

      workspaceKinds.applyNameFilter('workspace-kind-1');

      workspaceKinds.assertWorkspaceKindCount(DEFAULT_PAGE_SIZE);
      workspaceKinds.assertWorkspaceKindRowName(0, 'workspace-kind-1');
      workspaceKinds.assertWorkspaceKindRowName(9, 'workspace-kind-18');
      workspaceKinds.assertPaginationRange({ firstItem: 1, lastItem: 10, totalItems: 11 });
    });

    it('should change number of rows when page size is changed', () => {
      const { mockWorkspaceKinds } = setupWorkspaceKinds(25);

      visitWorkspaceKinds();

      workspaceKinds.assertWorkspaceKindCount(DEFAULT_PAGE_SIZE);
      workspaceKinds.assertPaginationRange({ firstItem: 1, lastItem: 10, totalItems: 25 });

      workspaceKinds.selectPerPage(20);

      workspaceKinds.assertWorkspaceKindCount(20);
      workspaceKinds.assertWorkspaceKindRowName(0, mockWorkspaceKinds[0].name);
      workspaceKinds.assertWorkspaceKindRowName(19, mockWorkspaceKinds[19].name);
      workspaceKinds.assertPaginationRange({ firstItem: 1, lastItem: 20, totalItems: 25 });

      workspaceKinds.selectPerPage(50);

      workspaceKinds.assertWorkspaceKindCount(25);
      workspaceKinds.assertWorkspaceKindRowName(0, mockWorkspaceKinds[0].name);
      workspaceKinds.assertWorkspaceKindRowName(24, mockWorkspaceKinds[24].name);
      workspaceKinds.assertPaginationRange({ firstItem: 1, lastItem: 25, totalItems: 25 });
    });

    it('should show empty state when filter returns no results', () => {
      setupWorkspaceKinds(10);

      visitWorkspaceKinds();

      workspaceKinds.assertWorkspaceKindCount(DEFAULT_PAGE_SIZE);

      workspaceKinds.applyNameFilter('nonexistent-workspace-kind');

      workspaceKinds.assertWorkspaceKindCount(0);
      workspaceKinds.assertEmptyStateVisible();
    });
  });

  describe('Actions', () => {
    const TEST_WORKSPACEKIND_NAME = 'test-workspace-kind';

    const setupWorkspaceKindActionTest = (
      workspaceKindName: string,
      deprecated = false,
    ): WorkspacekindsWorkspaceKind => {
      const mockWorkspaceKind = buildMockWorkspaceKind({
        name: workspaceKindName,
        displayName: workspaceKindName,
        deprecated,
      });

      const mockNamespace = buildMockNamespace({ name: DEFAULT_NAMESPACE });

      cy.interceptApi(
        'GET /api/:apiVersion/namespaces',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse([mockNamespace]),
      ).as('getNamespaces');

      cy.interceptApi(
        'GET /api/:apiVersion/workspacekinds',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse([mockWorkspaceKind]),
      ).as('getWorkspaceKinds');

      cy.interceptApi(
        'GET /api/:apiVersion/workspaces/:namespace',
        { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockNamespace.name } },
        mockModArchResponse([]),
      ).as('getWorkspaces');

      cy.interceptApi(
        'GET /api/:apiVersion/workspaces',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse([]),
      ).as('getAllWorkspaces');

      visitWorkspaceKinds();

      return mockWorkspaceKind;
    };

    describe('View Details', () => {
      it('should open workspace kind details drawer from actions menu', () => {
        setupWorkspaceKindActionTest(TEST_WORKSPACEKIND_NAME);

        workspaceKinds
          .findAction({ action: 'view-details', workspaceKindName: TEST_WORKSPACEKIND_NAME })
          .click();

        workspaceKindDetailsDrawer.shouldBeVisible();
      });

      it('should close workspace kind details drawer', () => {
        setupWorkspaceKindActionTest(TEST_WORKSPACEKIND_NAME);

        workspaceKinds
          .findAction({ action: 'view-details', workspaceKindName: TEST_WORKSPACEKIND_NAME })
          .click();

        workspaceKindDetailsDrawer.shouldBeVisible();
        workspaceKindDetailsDrawer.findCloseButton().click();
        workspaceKindDetailsDrawer.shouldNotExist();
      });

      it('should update drawer content when switching between workspace kinds', () => {
        const workspaceKind1 = buildMockWorkspaceKind({
          name: 'workspacekind1',
          displayName: 'Workspace Kind 1',
        });
        const workspaceKind2 = buildMockWorkspaceKind({
          name: 'workspacekind2',
          displayName: 'Workspace Kind 2',
        });

        const mockNamespace = buildMockNamespace({ name: DEFAULT_NAMESPACE });

        cy.interceptApi(
          'GET /api/:apiVersion/namespaces',
          { path: { apiVersion: NOTEBOOKS_API_VERSION } },
          mockModArchResponse([mockNamespace]),
        ).as('getNamespaces');

        cy.interceptApi(
          'GET /api/:apiVersion/workspacekinds',
          { path: { apiVersion: NOTEBOOKS_API_VERSION } },
          mockModArchResponse([workspaceKind1, workspaceKind2]),
        ).as('getWorkspaceKinds');

        cy.interceptApi(
          'GET /api/:apiVersion/workspaces/:namespace',
          { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockNamespace.name } },
          mockModArchResponse([]),
        ).as('getWorkspaces');

        cy.interceptApi(
          'GET /api/:apiVersion/workspaces',
          { path: { apiVersion: NOTEBOOKS_API_VERSION } },
          mockModArchResponse([]),
        ).as('getAllWorkspaces');

        visitWorkspaceKinds();

        // Open first workspace kind details
        workspaceKinds
          .findAction({ action: 'view-details', workspaceKindName: workspaceKind1.name })
          .click();
        workspaceKindDetailsDrawer.shouldBeVisible();
        workspaceKindDetailsDrawer.findCloseButton().click();

        // Open second workspace kind details
        workspaceKinds
          .findAction({ action: 'view-details', workspaceKindName: workspaceKind2.name })
          .click();
        workspaceKindDetailsDrawer.shouldBeVisible();
      });
    });

    describe('Edit', () => {
      it('should navigate to edit workspace kind page from actions menu', () => {
        setupWorkspaceKindActionTest(TEST_WORKSPACEKIND_NAME);

        workspaceKinds
          .findAction({ action: 'edit-workspace-kind', workspaceKindName: TEST_WORKSPACEKIND_NAME })
          .click();

        editWorkspaceKind.verifyPageURL(TEST_WORKSPACEKIND_NAME);
      });
    });
  });
});
