import { mockModArchResponse } from 'mod-arch-core';
import { createWorkspace } from '~/__tests__/cypress/cypress/pages/workspaces/createWorkspace';
import { NOTEBOOKS_API_VERSION } from '~/__tests__/cypress/cypress/support/commands/api';
import { buildMockNamespace, buildMockWorkspaceKind } from '~/shared/mock/mockBuilder';
import { WorkspacekindsRedirectMessageLevel } from '~/generated/data-contracts';

describe('Workspace Form - Option Card Display', () => {
  const mockNamespace = buildMockNamespace({ name: 'default' });

  beforeEach(() => {
    cy.interceptApi(
      'GET /api/:apiVersion/namespaces',
      { path: { apiVersion: NOTEBOOKS_API_VERSION } },
      mockModArchResponse([mockNamespace]),
    );
  });

  describe('Visual indicators for hidden options', () => {
    it('should show grey left border and hidden icon for hidden option', () => {
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
                  id: 'jupyterlab_scipy_200_hidden',
                  displayName: 'jupyter-scipy:v2.0.0 (Hidden)',
                  description: 'JupyterLab v2.0.0',
                  labels: [],
                  hidden: true,
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

      // Enable "Show hidden" to see the hidden option
      createWorkspace.checkExtraFilter('showHidden');

      // Check that hidden option has the correct class
      cy.get('#jupyterlab_scipy_200_hidden')
        .should('have.class', 'workspace-option-card--hidden')
        .within(() => {
          // Hidden icon should be visible
          cy.get('[data-testid*="hidden-icon"]').should('exist');
        });

      // Non-hidden option should not have the class
      cy.get('#jupyterlab_scipy_190').should('not.have.class', 'workspace-option-card--hidden');
    });
  });

  describe('Visual indicators for redirected options', () => {
    it('should show brown left border and redirect icon for redirected option', () => {
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
                  redirect: {
                    to: 'jupyterlab_scipy_190',
                    message: {
                      text: 'Redirecting to newer version',
                      level: WorkspacekindsRedirectMessageLevel.RedirectMessageLevelInfo,
                    },
                  },
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

      // Enable "Show redirected" to see the redirected option
      createWorkspace.checkExtraFilter('showRedirected');

      // Check that redirected option has the correct class
      cy.get('#jupyterlab_scipy_180')
        .should('have.class', 'workspace-option-card--redirected')
        .within(() => {
          // Redirect icon should be visible
          cy.get('[data-testid*="redirect-icon"]').should('exist');
        });

      // Non-redirected option should not have the class
      cy.get('#jupyterlab_scipy_190').should('not.have.class', 'workspace-option-card--redirected');
    });
  });

  describe('Visual indicators for hidden AND redirected options', () => {
    it('should show grey border (hidden takes precedence) with both icons', () => {
      const mockWorkspaceKind = buildMockWorkspaceKind({
        name: 'jupyterlab',
        podTemplate: {
          ...buildMockWorkspaceKind().podTemplate,
          options: {
            imageConfig: {
              default: 'jupyterlab_scipy_190',
              values: [
                {
                  id: 'jupyterlab_scipy_180_hidden',
                  displayName: 'jupyter-scipy:v1.8.0 (Hidden)',
                  description: 'JupyterLab v1.8.0',
                  labels: [],
                  hidden: true,
                  redirect: {
                    to: 'jupyterlab_scipy_190',
                    message: {
                      text: 'Redirecting to newer version',
                      level: WorkspacekindsRedirectMessageLevel.RedirectMessageLevelWarning,
                    },
                  },
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

      // Enable both filters to see the option
      createWorkspace.checkExtraFilter('showHidden');
      createWorkspace.checkExtraFilter('showRedirected');

      // Check that option has both classes
      cy.get('#jupyterlab_scipy_180_hidden')
        .should('have.class', 'workspace-option-card--hidden')
        .should('have.class', 'workspace-option-card--redirected')
        .within(() => {
          // Both icons should be visible
          cy.get('[data-testid*="hidden-icon"]').should('exist');
          cy.get('[data-testid*="redirect-icon"]').should('exist');
        });
    });
  });

  describe('Default badge display', () => {
    it('should show "Default" badge on default option', () => {
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

      // Default option should show badge
      cy.get('#jupyterlab_scipy_190').within(() => {
        cy.contains('Default').should('be.visible');
      });

      // Non-default option should not show badge
      cy.get('#jupyterlab_scipy_180').within(() => {
        cy.contains('Default').should('not.exist');
      });
    });

    it('should show "Default" badge on default pod config', () => {
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
      createWorkspace.clickNext();

      // Default pod config should show badge
      cy.get('#medium_cpu').within(() => {
        cy.contains('Default').should('be.visible');
      });

      // Non-default pod config should not show badge
      cy.get('#tiny_cpu').within(() => {
        cy.contains('Default').should('not.exist');
      });
    });
  });

  describe('Selection highlighting', () => {
    it('should highlight selected card with grey background', () => {
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

      // Default option should be auto-selected
      cy.get('#jupyterlab_scipy_190').should('have.class', 'pf-m-selected');

      // Click different option
      createWorkspace.selectImage('jupyterlab_scipy_200');

      // New selection should be highlighted
      cy.get('#jupyterlab_scipy_200').should('have.class', 'pf-m-selected');

      // Previous selection should not be highlighted
      cy.get('#jupyterlab_scipy_190').should('not.have.class', 'pf-m-selected');
    });
  });

  describe('Combined visual states', () => {
    it('should correctly display hidden default option with all indicators', () => {
      const mockWorkspaceKind = buildMockWorkspaceKind({
        name: 'jupyterlab',
        podTemplate: {
          ...buildMockWorkspaceKind().podTemplate,
          options: {
            imageConfig: {
              default: 'jupyterlab_scipy_200_hidden',
              values: [
                {
                  id: 'jupyterlab_scipy_190',
                  displayName: 'jupyter-scipy:v1.9.0',
                  description: 'JupyterLab v1.9.0',
                  labels: [],
                  hidden: false,
                },
                {
                  id: 'jupyterlab_scipy_200_hidden',
                  displayName: 'jupyter-scipy:v2.0.0 (Hidden)',
                  description: 'JupyterLab v2.0.0',
                  labels: [],
                  hidden: true,
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

      cy.get('#jupyterlab_scipy_200_hidden')
        // Should be selected (auto-selected as default)
        .should('have.class', 'pf-m-selected')
        // Should have hidden class (grey border)
        .should('have.class', 'workspace-option-card--hidden')
        .within(() => {
          // Should show "Default" badge
          cy.contains('Default').should('be.visible');
          // Should show hidden icon
          cy.get('[data-testid*="hidden-icon"]').should('exist');
        });
    });
  });
});
