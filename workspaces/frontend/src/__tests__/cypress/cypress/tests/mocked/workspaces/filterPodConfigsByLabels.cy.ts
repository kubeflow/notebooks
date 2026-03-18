import { mockModArchResponse } from 'mod-arch-core';
import { createWorkspace } from '~/__tests__/cypress/cypress/pages/workspaces/createWorkspace';
import { workspaces } from '~/__tests__/cypress/cypress/pages/workspaces/workspaces';
import { NOTEBOOKS_API_VERSION } from '~/__tests__/cypress/cypress/support/commands/api';
import {
  buildMockNamespace,
  buildMockWorkspace,
  buildMockWorkspaceKind,
} from '~/shared/mock/mockBuilder';
import { navBar } from '~/__tests__/cypress/cypress/pages/components/navBar';
import { buildMockPodConfigWithLabels } from '~/__tests__/cypress/cypress/utils/testBuilders';
import type { WorkspacekindsWorkspaceKind } from '~/generated/data-contracts';

const STEP_NAMES = {
  KIND: 'Workspace Kind',
  IMAGE: 'Image',
  POD_CONFIG: 'Pod Config',
  PROPERTIES: 'Properties',
} as const;

describe('Filter Pod Configs by Labels', () => {
  const mockNamespace = buildMockNamespace({ name: 'default' });
  const mockWorkspaces = [buildMockWorkspace({})];

  const mockPodConfigs = [
    buildMockPodConfigWithLabels('tiny-cpu', 'Tiny CPU', [
      { key: 'cpu', value: '1' },
      { key: 'memory', value: '2Gi' },
    ]),
    buildMockPodConfigWithLabels('small-cpu', 'Small CPU', [
      { key: 'cpu', value: '2' },
      { key: 'memory', value: '4Gi' },
    ]),
    buildMockPodConfigWithLabels('medium-cpu', 'Medium CPU', [
      { key: 'cpu', value: '4' },
      { key: 'memory', value: '8Gi' },
    ]),
    buildMockPodConfigWithLabels('large-cpu', 'Large CPU', [
      { key: 'cpu', value: '8' },
      { key: 'memory', value: '16Gi' },
    ]),
    buildMockPodConfigWithLabels('small-gpu', 'Small GPU', [
      { key: 'cpu', value: '2' },
      { key: 'memory', value: '4Gi' },
      { key: 'gpu', value: '1' },
    ]),
    buildMockPodConfigWithLabels('large-gpu', 'Large GPU', [
      { key: 'cpu', value: '8' },
      { key: 'memory', value: '16Gi' },
      { key: 'gpu', value: '2' },
    ]),
    buildMockPodConfigWithLabels('xlarge-mem', 'XLarge Memory', [
      { key: 'cpu', value: '4' },
      { key: 'memory', value: '32Gi' },
    ]),
  ];

  const mockWorkspaceKind: WorkspacekindsWorkspaceKind = buildMockWorkspaceKind({
    name: 'jupyterlab',
    podTemplate: {
      ...buildMockWorkspaceKind().podTemplate,
      options: {
        imageConfig: {
          default: 'jupyter',
          values: [
            {
              id: 'jupyter',
              displayName: 'Jupyter',
              description: 'Standard Jupyter image',
              labels: [],
              hidden: false,
            },
          ],
        },
        podConfig: {
          default: 'tiny-cpu',
          values: mockPodConfigs,
        },
      },
    },
  });

  beforeEach(() => {
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
      'GET /api/:apiVersion/workspacekinds',
      { path: { apiVersion: NOTEBOOKS_API_VERSION } },
      mockModArchResponse([mockWorkspaceKind]),
    ).as('getWorkspaceKinds');

    workspaces.visit();
    cy.wait('@getNamespaces');

    navBar.selectNamespace(mockNamespace.name);
    cy.wait('@getWorkspaces');

    workspaces.findCreateWorkspaceButton().click();
    cy.wait('@getWorkspaceKinds');

    createWorkspace.selectKind(mockWorkspaceKind.name);
    createWorkspace.clickNext();

    createWorkspace.selectImage('jupyter');
    createWorkspace.clickNext();
  });

  describe('Label filtering', () => {
    it('should display all unique label categories', () => {
      createWorkspace.assertLabelCategoryExists('cpu');
      createWorkspace.assertLabelCategoryExists('memory');
      createWorkspace.assertLabelCategoryExists('gpu');
    });

    it('should filter pod configs by CPU label', () => {
      createWorkspace.findPodConfigCard('tiny-cpu').should('be.visible');
      createWorkspace.findPodConfigCard('small-cpu').should('be.visible');
      createWorkspace.findPodConfigCard('medium-cpu').should('be.visible');
      createWorkspace.findPodConfigCard('large-cpu').should('be.visible');

      createWorkspace.clickLabelFilter('cpu', '1');
      createWorkspace.assertLabelFilterChecked('cpu', '1');

      createWorkspace.findPodConfigCard('tiny-cpu').should('be.visible');
      createWorkspace.findPodConfigCard('small-cpu').should('not.exist');
      createWorkspace.findPodConfigCard('medium-cpu').should('not.exist');
      createWorkspace.findPodConfigCard('large-cpu').should('not.exist');
    });

    it('should filter pod configs by Memory label', () => {
      createWorkspace.clickLabelFilter('memory', '4Gi');
      createWorkspace.assertLabelFilterChecked('memory', '4Gi');

      createWorkspace.findPodConfigCard('small-cpu').should('be.visible');
      createWorkspace.findPodConfigCard('small-gpu').should('be.visible');
      createWorkspace.findPodConfigCard('tiny-cpu').should('not.exist');
      createWorkspace.findPodConfigCard('medium-cpu').should('not.exist');
    });

    it('should filter pod configs by GPU label', () => {
      createWorkspace.clickLabelFilter('gpu', '1');
      createWorkspace.assertLabelFilterChecked('gpu', '1');

      createWorkspace.findPodConfigCard('small-gpu').should('be.visible');
      createWorkspace.findPodConfigCard('tiny-cpu').should('not.exist');
      createWorkspace.findPodConfigCard('large-gpu').should('not.exist');
    });

    it('should filter pod configs by multiple values within same category (OR logic)', () => {
      createWorkspace.clickLabelFilter('cpu', '2');
      createWorkspace.clickLabelFilter('cpu', '4');

      createWorkspace.assertLabelFilterChecked('cpu', '2');
      createWorkspace.assertLabelFilterChecked('cpu', '4');

      createWorkspace.findPodConfigCard('small-cpu').should('be.visible');
      createWorkspace.findPodConfigCard('medium-cpu').should('be.visible');
      createWorkspace.findPodConfigCard('small-gpu').should('be.visible');
      createWorkspace.findPodConfigCard('xlarge-mem').should('be.visible');
      createWorkspace.findPodConfigCard('tiny-cpu').should('not.exist');
      createWorkspace.findPodConfigCard('large-cpu').should('not.exist');
    });

    it('should filter pod configs by multiple categories (AND logic)', () => {
      createWorkspace.clickLabelFilter('cpu', '2');
      createWorkspace.clickLabelFilter('memory', '4Gi');

      createWorkspace.assertLabelFilterChecked('cpu', '2');
      createWorkspace.assertLabelFilterChecked('memory', '4Gi');

      createWorkspace.findPodConfigCard('small-cpu').should('be.visible');
      createWorkspace.findPodConfigCard('small-gpu').should('be.visible');
      createWorkspace.findPodConfigCard('tiny-cpu').should('not.exist');
      createWorkspace.findPodConfigCard('medium-cpu').should('not.exist');
    });

    it('should uncheck label filter and restore filtered pod configs', () => {
      createWorkspace.clickLabelFilter('cpu', '1');
      createWorkspace.assertLabelFilterChecked('cpu', '1');

      createWorkspace.findPodConfigCard('tiny-cpu').should('be.visible');
      createWorkspace.findPodConfigCard('small-cpu').should('not.exist');

      createWorkspace.clickLabelFilter('cpu', '1');
      createWorkspace.assertLabelFilterNotChecked('cpu', '1');

      createWorkspace.findPodConfigCard('tiny-cpu').should('be.visible');
      createWorkspace.findPodConfigCard('small-cpu').should('be.visible');
    });

    it('should show no results when no pod configs match filter', () => {
      createWorkspace.clickLabelFilter('cpu', '1');
      createWorkspace.clickLabelFilter('memory', '16Gi');

      createWorkspace.assertNoResultsFound();
    });

    it('should display label keys without capitalization', () => {
      createWorkspace.findLabelCategory('cpu').should('contain', 'cpu');
      createWorkspace.findLabelCategory('memory').should('contain', 'memory');
      createWorkspace.findLabelCategory('gpu').should('contain', 'gpu');
    });
  });

  describe('UI state', () => {
    it('should maintain selected pod config when navigating back and forth', () => {
      createWorkspace.clickLabelFilter('cpu', '2');
      createWorkspace.selectPodConfig('small-cpu');

      createWorkspace.clickNext();
      createWorkspace.assertProgressStepVisible(STEP_NAMES.PROPERTIES);

      createWorkspace.clickPrevious();
      createWorkspace.assertProgressStepVisible(STEP_NAMES.POD_CONFIG);

      createWorkspace.assertPodConfigSelected('small-cpu');
    });

    it('should preserve selected pod config when applying filters', () => {
      createWorkspace.selectPodConfig('small-cpu');
      createWorkspace.assertPodConfigSelected('small-cpu');

      createWorkspace.clickLabelFilter('cpu', '2');

      createWorkspace.assertPodConfigSelected('small-cpu');
      createWorkspace.findPodConfigCard('small-cpu').should('be.visible');
    });
  });

  describe('Extra filters for pod configs', () => {
    it('should display extra filters category with unchecked filters when no options are hidden or redirected', () => {
      cy.findByTestId('extra-filters-category').should('exist');
      cy.findByTestId('extra-filter-showHidden').find('input').should('not.be.checked');
      cy.findByTestId('extra-filter-showRedirected').find('input').should('not.be.checked');
    });
  });
});
