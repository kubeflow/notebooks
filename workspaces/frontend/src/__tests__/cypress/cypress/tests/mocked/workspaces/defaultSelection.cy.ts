import { mockModArchResponse } from 'mod-arch-core';
import { createWorkspace } from '~/__tests__/cypress/cypress/pages/workspaces/createWorkspace';
import { NOTEBOOKS_API_VERSION } from '~/__tests__/cypress/cypress/support/commands/api';
import { buildMockNamespace, buildMockWorkspaceKind } from '~/shared/mock/mockBuilder';

type ImageConfigOption = {
  id: string;
  displayName: string;
  description: string;
  labels?: { key: string; value: string }[];
  hidden?: boolean;
};

type PodConfigOption = {
  id: string;
  displayName: string;
  description: string;
  labels?: { key: string; value: string }[];
  hidden?: boolean;
};

const buildWorkspaceKindWithOptions = (overrides: {
  name?: string;
  defaultImageId?: string;
  imageOptions?: ImageConfigOption[];
  defaultPodConfigId?: string;
  podConfigOptions?: PodConfigOption[];
}) => {
  const {
    name = 'jupyterlab',
    defaultImageId = '',
    imageOptions = [],
    defaultPodConfigId = '',
    podConfigOptions = [],
  } = overrides;

  return buildMockWorkspaceKind({
    name,
    podTemplate: {
      ...buildMockWorkspaceKind().podTemplate,
      options: {
        imageConfig: {
          default: defaultImageId,
          values: imageOptions.map((img) => ({
            id: img.id,
            displayName: img.displayName,
            description: img.description,
            labels: img.labels || [],
            hidden: img.hidden || false,
          })),
        },
        podConfig: {
          default: defaultPodConfigId,
          values: podConfigOptions.map((pc) => ({
            id: pc.id,
            displayName: pc.displayName,
            description: pc.description,
            labels: pc.labels || [],
            hidden: pc.hidden || false,
          })),
        },
      },
    },
  });
};

describe('Workspace Form - Default Selection', () => {
  const mockNamespace = buildMockNamespace({ name: 'default' });

  beforeEach(() => {
    cy.interceptApi(
      'GET /api/:apiVersion/namespaces',
      { path: { apiVersion: NOTEBOOKS_API_VERSION } },
      mockModArchResponse([mockNamespace]),
    );
  });

  describe('Auto-selection of defaults', () => {
    it('should auto-select default image when workspace kind selected', () => {
      const mockWorkspaceKind = buildWorkspaceKindWithOptions({
        defaultImageId: 'jupyterlab_scipy_190',
        imageOptions: [
          {
            id: 'jupyterlab_scipy_180',
            displayName: 'jupyter-scipy:v1.8.0',
            description: 'JupyterLab v1.8.0',
          },
          {
            id: 'jupyterlab_scipy_190',
            displayName: 'jupyter-scipy:v1.9.0',
            description: 'JupyterLab v1.9.0',
          },
        ],
        defaultPodConfigId: 'tiny_cpu',
        podConfigOptions: [{ id: 'tiny_cpu', displayName: 'Tiny CPU', description: 'Small pod' }],
      });

      cy.interceptApi(
        'GET /api/:apiVersion/workspacekinds',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse([mockWorkspaceKind]),
      ).as('getWorkspaceKinds');

      createWorkspace.visit();
      cy.wait('@getWorkspaceKinds');

      createWorkspace.selectKind('jupyterlab');
      createWorkspace.clickNext();

      // Should auto-select the default image
      createWorkspace.assertImageSelected('jupyterlab_scipy_190');
    });

    it('should auto-select default pod config when workspace kind selected', () => {
      const mockWorkspaceKind = buildWorkspaceKindWithOptions({
        defaultImageId: 'jupyterlab_scipy_190',
        imageOptions: [
          {
            id: 'jupyterlab_scipy_190',
            displayName: 'jupyter-scipy:v1.9.0',
            description: 'JupyterLab v1.9.0',
          },
        ],
        defaultPodConfigId: 'small_cpu',
        podConfigOptions: [
          { id: 'tiny_cpu', displayName: 'Tiny CPU', description: 'Small pod' },
          { id: 'small_cpu', displayName: 'Small CPU', description: 'Medium pod' },
        ],
      });

      cy.interceptApi(
        'GET /api/:apiVersion/workspacekinds',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse([mockWorkspaceKind]),
      ).as('getWorkspaceKinds');

      createWorkspace.visit();
      cy.wait('@getWorkspaceKinds');

      createWorkspace.selectKind('jupyterlab');
      createWorkspace.clickNext();
      createWorkspace.clickNext();

      // Should auto-select the default pod config
      createWorkspace.assertPodConfigSelected('small_cpu');
    });

    it('should auto-select both defaults when kind has both defined', () => {
      const mockWorkspaceKind = buildWorkspaceKindWithOptions({
        defaultImageId: 'jupyterlab_scipy_200',
        imageOptions: [
          {
            id: 'jupyterlab_scipy_190',
            displayName: 'jupyter-scipy:v1.9.0',
            description: 'JupyterLab v1.9.0',
          },
          {
            id: 'jupyterlab_scipy_200',
            displayName: 'jupyter-scipy:v2.0.0',
            description: 'JupyterLab v2.0.0',
          },
        ],
        defaultPodConfigId: 'medium_cpu',
        podConfigOptions: [
          { id: 'tiny_cpu', displayName: 'Tiny CPU', description: 'Small pod' },
          { id: 'medium_cpu', displayName: 'Medium CPU', description: 'Medium pod' },
        ],
      });

      cy.interceptApi(
        'GET /api/:apiVersion/workspacekinds',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse([mockWorkspaceKind]),
      ).as('getWorkspaceKinds');

      createWorkspace.visit();
      cy.wait('@getWorkspaceKinds');

      createWorkspace.selectKind('jupyterlab');
      createWorkspace.clickNext();

      createWorkspace.assertImageSelected('jupyterlab_scipy_200');

      createWorkspace.clickNext();

      createWorkspace.assertPodConfigSelected('medium_cpu');
    });

    it('should not auto-select when kind has no default image', () => {
      const mockWorkspaceKind = buildWorkspaceKindWithOptions({
        defaultImageId: '', // No default (empty string means no match)
        imageOptions: [
          {
            id: 'jupyterlab_scipy_190',
            displayName: 'jupyter-scipy:v1.9.0',
            description: 'JupyterLab v1.9.0',
          },
          {
            id: 'jupyterlab_scipy_200',
            displayName: 'jupyter-scipy:v2.0.0',
            description: 'JupyterLab v2.0.0',
          },
        ],
        defaultPodConfigId: 'tiny_cpu',
        podConfigOptions: [{ id: 'tiny_cpu', displayName: 'Tiny CPU', description: 'Small pod' }],
      });

      cy.interceptApi(
        'GET /api/:apiVersion/workspacekinds',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse([mockWorkspaceKind]),
      ).as('getWorkspaceKinds');

      createWorkspace.visit();
      cy.wait('@getWorkspaceKinds');

      createWorkspace.selectKind('jupyterlab');
      createWorkspace.clickNext();

      // Neither should be selected
      cy.get('#jupyterlab_scipy_190').should('not.have.class', 'pf-m-selected');
      cy.get('#jupyterlab_scipy_200').should('not.have.class', 'pf-m-selected');
    });
  });

  describe('Default option ordering', () => {
    it('should display default image first in list', () => {
      const mockWorkspaceKind = buildWorkspaceKindWithOptions({
        defaultImageId: 'jupyterlab_scipy_200', // Third in original list
        imageOptions: [
          {
            id: 'jupyterlab_scipy_180',
            displayName: 'jupyter-scipy:v1.8.0',
            description: 'JupyterLab v1.8.0',
          },
          {
            id: 'jupyterlab_scipy_190',
            displayName: 'jupyter-scipy:v1.9.0',
            description: 'JupyterLab v1.9.0',
          },
          {
            id: 'jupyterlab_scipy_200',
            displayName: 'jupyter-scipy:v2.0.0',
            description: 'JupyterLab v2.0.0',
          },
        ],
        defaultPodConfigId: 'tiny_cpu',
        podConfigOptions: [{ id: 'tiny_cpu', displayName: 'Tiny CPU', description: 'Small pod' }],
      });

      cy.interceptApi(
        'GET /api/:apiVersion/workspacekinds',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse([mockWorkspaceKind]),
      ).as('getWorkspaceKinds');

      createWorkspace.visit();
      cy.wait('@getWorkspaceKinds');

      createWorkspace.selectKind('jupyterlab');
      createWorkspace.clickNext();

      // Get all card IDs in order and verify default is first
      cy.get('.pf-v6-c-card').first().should('have.id', 'jupyterlab_scipy_200');
    });

    it('should display "Default" badge on default option', () => {
      const mockWorkspaceKind = buildWorkspaceKindWithOptions({
        defaultImageId: 'jupyterlab_scipy_190',
        imageOptions: [
          {
            id: 'jupyterlab_scipy_190',
            displayName: 'jupyter-scipy:v1.9.0',
            description: 'JupyterLab v1.9.0',
          },
          {
            id: 'jupyterlab_scipy_200',
            displayName: 'jupyter-scipy:v2.0.0',
            description: 'JupyterLab v2.0.0',
          },
        ],
        defaultPodConfigId: 'tiny_cpu',
        podConfigOptions: [{ id: 'tiny_cpu', displayName: 'Tiny CPU', description: 'Small pod' }],
      });

      cy.interceptApi(
        'GET /api/:apiVersion/workspacekinds',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse([mockWorkspaceKind]),
      ).as('getWorkspaceKinds');

      createWorkspace.visit();
      cy.wait('@getWorkspaceKinds');

      createWorkspace.selectKind('jupyterlab');
      createWorkspace.clickNext();

      // Verify "Default" badge is visible on the default option
      cy.get('#jupyterlab_scipy_190').within(() => {
        cy.contains('Default').should('be.visible');
      });

      // Verify non-default option does not have the badge
      cy.get('#jupyterlab_scipy_200').within(() => {
        cy.contains('Default').should('not.exist');
      });
    });
  });
});
