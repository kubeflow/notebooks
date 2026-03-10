import { mockModArchResponse } from 'mod-arch-core';
import { createWorkspace } from '~/__tests__/cypress/cypress/pages/workspaces/createWorkspace';
import { NOTEBOOKS_API_VERSION } from '~/__tests__/cypress/cypress/support/commands/api';
import { buildMockNamespace, buildMockWorkspaceKind } from '~/shared/mock/mockBuilder';

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
      const mockWorkspaceKind = buildMockWorkspaceKind({
        name: 'jupyterlab',
        podTemplate: {
          ...buildMockWorkspaceKind().podTemplate,
          options: {
            imageConfig: {
              default: 'jupyterlab_scipy_190',
              values: [
                {
                  id: 'jupyterlab_scipy_180',
                  displayName: 'jupyter-scipy:v1.8.0',
                  description: 'JupyterLab v1.8.0',
                  labels: [],
                  hidden: false,
                },
                {
                  id: 'jupyterlab_scipy_190',
                  displayName: 'jupyter-scipy:v1.9.0',
                  description: 'JupyterLab v1.9.0',
                  labels: [],
                  hidden: false,
                },
              ],
            },
            podConfig: {
              default: 'tiny_cpu',
              values: [
                {
                  id: 'tiny_cpu',
                  displayName: 'Tiny CPU',
                  description: 'Small pod',
                  labels: [],
                  hidden: false,
                },
              ],
            },
          },
        },
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
      const mockWorkspaceKind = buildMockWorkspaceKind({
        name: 'jupyterlab',
        podTemplate: {
          ...buildMockWorkspaceKind().podTemplate,
          options: {
            imageConfig: {
              default: 'jupyterlab_scipy_190',
              values: [
                {
                  id: 'jupyterlab_scipy_190',
                  displayName: 'jupyter-scipy:v1.9.0',
                  description: 'JupyterLab v1.9.0',
                  labels: [],
                  hidden: false,
                },
              ],
            },
            podConfig: {
              default: 'small_cpu',
              values: [
                {
                  id: 'tiny_cpu',
                  displayName: 'Tiny CPU',
                  description: 'Small pod',
                  labels: [],
                  hidden: false,
                },
                {
                  id: 'small_cpu',
                  displayName: 'Small CPU',
                  description: 'Medium pod',
                  labels: [],
                  hidden: false,
                },
              ],
            },
          },
        },
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
      const mockWorkspaceKind = buildMockWorkspaceKind({
        name: 'jupyterlab',
        podTemplate: {
          ...buildMockWorkspaceKind().podTemplate,
          options: {
            imageConfig: {
              default: 'jupyterlab_scipy_200',
              values: [
                {
                  id: 'jupyterlab_scipy_190',
                  displayName: 'jupyter-scipy:v1.9.0',
                  description: 'JupyterLab v1.9.0',
                  labels: [],
                  hidden: false,
                },
                {
                  id: 'jupyterlab_scipy_200',
                  displayName: 'jupyter-scipy:v2.0.0',
                  description: 'JupyterLab v2.0.0',
                  labels: [],
                  hidden: false,
                },
              ],
            },
            podConfig: {
              default: 'medium_cpu',
              values: [
                {
                  id: 'tiny_cpu',
                  displayName: 'Tiny CPU',
                  description: 'Small pod',
                  labels: [],
                  hidden: false,
                },
                {
                  id: 'medium_cpu',
                  displayName: 'Medium CPU',
                  description: 'Medium pod',
                  labels: [],
                  hidden: false,
                },
              ],
            },
          },
        },
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
      const mockWorkspaceKind = buildMockWorkspaceKind({
        name: 'jupyterlab',
        podTemplate: {
          ...buildMockWorkspaceKind().podTemplate,
          options: {
            imageConfig: {
              default: '', // No default (empty string means no match)
              values: [
                {
                  id: 'jupyterlab_scipy_190',
                  displayName: 'jupyter-scipy:v1.9.0',
                  description: 'JupyterLab v1.9.0',
                  labels: [],
                  hidden: false,
                },
                {
                  id: 'jupyterlab_scipy_200',
                  displayName: 'jupyter-scipy:v2.0.0',
                  description: 'JupyterLab v2.0.0',
                  labels: [],
                  hidden: false,
                },
              ],
            },
            podConfig: {
              default: 'tiny_cpu',
              values: [
                {
                  id: 'tiny_cpu',
                  displayName: 'Tiny CPU',
                  description: 'Small pod',
                  labels: [],
                  hidden: false,
                },
              ],
            },
          },
        },
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
      const mockWorkspaceKind = buildMockWorkspaceKind({
        name: 'jupyterlab',
        podTemplate: {
          ...buildMockWorkspaceKind().podTemplate,
          options: {
            imageConfig: {
              default: 'jupyterlab_scipy_200', // Third in original list
              values: [
                {
                  id: 'jupyterlab_scipy_180',
                  displayName: 'jupyter-scipy:v1.8.0',
                  description: 'JupyterLab v1.8.0',
                  labels: [],
                  hidden: false,
                },
                {
                  id: 'jupyterlab_scipy_190',
                  displayName: 'jupyter-scipy:v1.9.0',
                  description: 'JupyterLab v1.9.0',
                  labels: [],
                  hidden: false,
                },
                {
                  id: 'jupyterlab_scipy_200',
                  displayName: 'jupyter-scipy:v2.0.0',
                  description: 'JupyterLab v2.0.0',
                  labels: [],
                  hidden: false,
                },
              ],
            },
            podConfig: {
              default: 'tiny_cpu',
              values: [
                {
                  id: 'tiny_cpu',
                  displayName: 'Tiny CPU',
                  description: 'Small pod',
                  labels: [],
                  hidden: false,
                },
              ],
            },
          },
        },
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
      const mockWorkspaceKind = buildMockWorkspaceKind({
        name: 'jupyterlab',
        podTemplate: {
          ...buildMockWorkspaceKind().podTemplate,
          options: {
            imageConfig: {
              default: 'jupyterlab_scipy_190',
              values: [
                {
                  id: 'jupyterlab_scipy_190',
                  displayName: 'jupyter-scipy:v1.9.0',
                  description: 'JupyterLab v1.9.0',
                  labels: [],
                  hidden: false,
                },
                {
                  id: 'jupyterlab_scipy_200',
                  displayName: 'jupyter-scipy:v2.0.0',
                  description: 'JupyterLab v2.0.0',
                  labels: [],
                  hidden: false,
                },
              ],
            },
            podConfig: {
              default: 'tiny_cpu',
              values: [
                {
                  id: 'tiny_cpu',
                  displayName: 'Tiny CPU',
                  description: 'Small pod',
                  labels: [],
                  hidden: false,
                },
              ],
            },
          },
        },
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
