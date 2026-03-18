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
import { buildMockImageWithLabels } from '~/__tests__/cypress/cypress/utils/testBuilders';
import type { WorkspacekindsWorkspaceKind } from '~/generated/data-contracts';

const STEP_NAMES = {
  KIND: 'Workspace Kind',
  IMAGE: 'Image',
  POD_CONFIG: 'Pod Config',
  PROPERTIES: 'Properties',
} as const;

describe('Filter Images by Labels', () => {
  const mockNamespace = buildMockNamespace({ name: 'default' });
  const mockWorkspaces = [buildMockWorkspace({})];

  const mockImages = [
    buildMockImageWithLabels(
      'pytorch-39',
      'PyTorch 3.9',
      [
        { key: 'pythonVersion', value: '3.9' },
        { key: 'framework', value: 'pytorch' },
        { key: 'cpu', value: '2' },
      ],
      false,
    ),
    buildMockImageWithLabels(
      'pytorch-310',
      'PyTorch 3.10',
      [
        { key: 'pythonVersion', value: '3.10' },
        { key: 'framework', value: 'pytorch' },
        { key: 'cpu', value: '4' },
      ],
      false,
    ),
    buildMockImageWithLabels(
      'tensorflow-39',
      'TensorFlow 3.9',
      [
        { key: 'pythonVersion', value: '3.9' },
        { key: 'framework', value: 'tensorflow' },
        { key: 'cpu', value: '2' },
      ],
      false,
    ),
    buildMockImageWithLabels(
      'tensorflow-310',
      'TensorFlow 3.10',
      [
        { key: 'pythonVersion', value: '3.10' },
        { key: 'framework', value: 'tensorflow' },
        { key: 'cpu', value: '4' },
      ],
      false,
    ),
    buildMockImageWithLabels(
      'pytorch-gpu',
      'PyTorch GPU',
      [
        { key: 'pythonVersion', value: '3.9' },
        { key: 'framework', value: 'pytorch' },
        { key: 'gpu', value: '1' },
      ],
      true,
    ),
    buildMockImageWithLabels(
      'tensorflow-gpu',
      'TensorFlow GPU',
      [
        { key: 'pythonVersion', value: '3.10' },
        { key: 'framework', value: 'tensorflow' },
        { key: 'gpu', value: '1' },
      ],
      true,
    ),
    buildMockImageWithLabels(
      'special-chars',
      'Special Chars',
      [
        { key: 'version', value: '1.0-alpha' },
        { key: 'tag', value: 'test_value' },
      ],
      false,
    ),
  ];

  const mockWorkspaceKind: WorkspacekindsWorkspaceKind = buildMockWorkspaceKind({
    name: 'jupyterlab',
    podTemplate: {
      ...buildMockWorkspaceKind().podTemplate,
      options: {
        imageConfig: {
          default: 'pytorch-39',
          values: mockImages,
        },
        podConfig: {
          default: 'tiny_cpu',
          values: [
            {
              id: 'tiny_cpu',
              displayName: 'Tiny CPU',
              description: 'Small CPU configuration',
              labels: [],
              hidden: false,
            },
          ],
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

    createWorkspace.findImageCard('pytorch-39').should('be.visible');
  });

  describe('Label filtering', () => {
    it('should display all unique label categories', () => {
      createWorkspace.assertLabelCategoryExists('pythonVersion');
      createWorkspace.assertLabelCategoryExists('framework');
      createWorkspace.assertLabelCategoryExists('cpu');
      createWorkspace.assertLabelCategoryExists('gpu');
      createWorkspace.assertLabelCategoryExists('version');
      createWorkspace.assertLabelCategoryExists('tag');
    });

    it('should filter images by selecting a single label value', () => {
      createWorkspace.findImageCard('pytorch-39').should('be.visible');
      createWorkspace.findImageCard('tensorflow-39').should('be.visible');
      createWorkspace.findImageCard('pytorch-310').should('be.visible');
      createWorkspace.findImageCard('tensorflow-310').should('be.visible');

      createWorkspace.clickLabelFilter('pythonVersion', '3.9');
      createWorkspace.assertLabelFilterChecked('pythonVersion', '3.9');

      createWorkspace.findImageCard('pytorch-39').should('be.visible');
      createWorkspace.findImageCard('tensorflow-39').should('be.visible');
      createWorkspace.findImageCard('pytorch-310').should('not.exist');
      createWorkspace.findImageCard('tensorflow-310').should('not.exist');
    });

    it('should filter images by multiple values within same category (OR logic)', () => {
      createWorkspace.clickLabelFilter('pythonVersion', '3.9');
      createWorkspace.clickLabelFilter('pythonVersion', '3.10');

      createWorkspace.assertLabelFilterChecked('pythonVersion', '3.9');
      createWorkspace.assertLabelFilterChecked('pythonVersion', '3.10');

      createWorkspace.findImageCard('pytorch-39').should('be.visible');
      createWorkspace.findImageCard('tensorflow-39').should('be.visible');
      createWorkspace.findImageCard('pytorch-310').should('be.visible');
      createWorkspace.findImageCard('tensorflow-310').should('be.visible');
    });

    it('should filter images by multiple categories (AND logic)', () => {
      createWorkspace.clickLabelFilter('pythonVersion', '3.9');
      createWorkspace.clickLabelFilter('framework', 'pytorch');

      createWorkspace.assertLabelFilterChecked('pythonVersion', '3.9');
      createWorkspace.assertLabelFilterChecked('framework', 'pytorch');

      createWorkspace.findImageCard('pytorch-39').should('be.visible');
      createWorkspace.findImageCard('tensorflow-39').should('not.exist');
      createWorkspace.findImageCard('pytorch-310').should('not.exist');
      createWorkspace.findImageCard('tensorflow-310').should('not.exist');
    });

    it('should uncheck label filter and restore filtered images', () => {
      createWorkspace.clickLabelFilter('pythonVersion', '3.9');
      createWorkspace.assertLabelFilterChecked('pythonVersion', '3.9');

      createWorkspace.findImageCard('pytorch-39').should('be.visible');
      createWorkspace.findImageCard('pytorch-310').should('not.exist');

      createWorkspace.clickLabelFilter('pythonVersion', '3.9');
      createWorkspace.assertLabelFilterNotChecked('pythonVersion', '3.9');

      createWorkspace.findImageCard('pytorch-39').should('be.visible');
      createWorkspace.findImageCard('pytorch-310').should('be.visible');
    });

    it('should show no results when no images match filter', () => {
      createWorkspace.clickLabelFilter('pythonVersion', '3.9');
      createWorkspace.clickLabelFilter('cpu', '4');

      createWorkspace.assertNoResultsFound();
    });

    it('should handle labels with special characters', () => {
      createWorkspace.clickLabelFilter('version', '1.0-alpha');
      createWorkspace.assertLabelFilterChecked('version', '1.0-alpha');

      createWorkspace.findImageCard('special-chars').should('be.visible');
      createWorkspace.findImageCard('pytorch-39').should('not.exist');
    });

    it('should display label keys without capitalization', () => {
      createWorkspace.findLabelCategory('pythonVersion').should('contain', 'pythonVersion');
      createWorkspace.findLabelCategory('cpu').should('contain', 'cpu');
      createWorkspace.findLabelCategory('gpu').should('contain', 'gpu');
      createWorkspace.findLabelCategory('framework').should('contain', 'framework');
    });
  });

  describe('Extra filters', () => {
    it('should display extra filter checkboxes', () => {
      createWorkspace.findExtraFilter('showHidden').should('exist');
      createWorkspace.findExtraFilter('showRedirected').should('exist');
    });

    it('should filter hidden images with "Show hidden" checkbox', () => {
      createWorkspace.findImageCard('pytorch-gpu').should('not.exist');
      createWorkspace.findImageCard('tensorflow-gpu').should('not.exist');

      createWorkspace.assertExtraFilterNotChecked('showHidden');
      createWorkspace.clickExtraFilter('showHidden');
      createWorkspace.assertExtraFilterChecked('showHidden');

      createWorkspace.findImageCard('pytorch-39').should('be.visible');

      createWorkspace.findImageCard('pytorch-gpu').should('be.visible');
      createWorkspace.findImageCard('tensorflow-gpu').should('be.visible');
    });

    it('should toggle extra filters on and off', () => {
      createWorkspace.assertExtraFilterNotChecked('showHidden');

      createWorkspace.clickExtraFilter('showHidden');
      createWorkspace.assertExtraFilterChecked('showHidden');

      createWorkspace.clickExtraFilter('showHidden');
      createWorkspace.assertExtraFilterNotChecked('showHidden');
    });

    it('should combine extra filters with label filters', () => {
      createWorkspace.clickExtraFilter('showHidden');
      createWorkspace.assertExtraFilterChecked('showHidden');

      createWorkspace.findImageCard('pytorch-gpu').should('be.visible');

      createWorkspace.clickLabelFilter('framework', 'pytorch');
      createWorkspace.assertLabelFilterChecked('framework', 'pytorch');

      createWorkspace.findImageCard('pytorch-39').should('be.visible');
      createWorkspace.findImageCard('pytorch-310').should('be.visible');
      createWorkspace.findImageCard('pytorch-gpu').should('be.visible');
      createWorkspace.findImageCard('tensorflow-39').should('not.exist');
      createWorkspace.findImageCard('tensorflow-gpu').should('not.exist');
    });

    it('should toggle both extra filters together', () => {
      createWorkspace.assertExtraFilterNotChecked('showRedirected');

      createWorkspace.clickExtraFilter('showHidden');
      createWorkspace.assertExtraFilterChecked('showHidden');
    });
  });

  describe('UI state', () => {
    it('should maintain selected image when navigating back and forth', () => {
      createWorkspace.clickLabelFilter('pythonVersion', '3.9');
      createWorkspace.selectImage('pytorch-39');
      createWorkspace.assertImageSelected('pytorch-39');

      createWorkspace.clickNext();
      createWorkspace.assertProgressStepVisible(STEP_NAMES.POD_CONFIG);

      createWorkspace.clickPrevious();
      createWorkspace.assertProgressStepVisible(STEP_NAMES.IMAGE);

      createWorkspace.findImageCard('pytorch-39').should('be.visible');

      createWorkspace.assertImageSelected('pytorch-39');
    });

    it('should preserve selected image when applying filters', () => {
      createWorkspace.selectImage('pytorch-39');
      createWorkspace.assertImageSelected('pytorch-39');

      createWorkspace.clickLabelFilter('pythonVersion', '3.9');

      createWorkspace.assertImageSelected('pytorch-39');
      createWorkspace.findImageCard('pytorch-39').should('be.visible');
    });
  });
});
