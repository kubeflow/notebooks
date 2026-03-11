import { mockModArchResponse } from 'mod-arch-core';
import { createWorkspace } from '~/__tests__/cypress/cypress/pages/workspaces/createWorkspace';
import { NOTEBOOKS_API_VERSION } from '~/__tests__/cypress/cypress/support/commands/api';
import { buildMockNamespace, buildMockWorkspaceKind } from '~/shared/mock/mockBuilder';
import { WorkspacekindsRedirectMessageLevel } from '~/generated/data-contracts';

describe('Workspace Form - Smart Filter Defaults', () => {
  const mockNamespace = buildMockNamespace({ name: 'default' });

  beforeEach(() => {
    cy.interceptApi(
      'GET /api/:apiVersion/namespaces',
      { path: { apiVersion: NOTEBOOKS_API_VERSION } },
      mockModArchResponse([mockNamespace]),
    );
  });

  describe('Image filter defaults', () => {
    it('should check "Show hidden" when default image is hidden', () => {
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
                  hidden: true, // Default is hidden
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

      // "Show hidden" should be checked by default
      createWorkspace.assertExtraFilterChecked('showHidden');
      // "Show redirected" should not be checked (default is not redirected)
      createWorkspace.assertExtraFilterNotChecked('showRedirected');
    });

    it('should check "Show redirected" when default image is redirected', () => {
      const mockWorkspaceKind = buildMockWorkspaceKind({
        name: 'jupyterlab',
        podTemplate: {
          ...buildMockWorkspaceKind().podTemplate,
          options: {
            imageConfig: {
              default: 'jupyterlab_scipy_180',
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

      // "Show redirected" should be checked by default
      createWorkspace.assertExtraFilterChecked('showRedirected');
      // "Show hidden" should not be checked (default is not hidden)
      createWorkspace.assertExtraFilterNotChecked('showHidden');
    });

    it('should check both filters when default is hidden AND redirected', () => {
      const mockWorkspaceKind = buildMockWorkspaceKind({
        name: 'jupyterlab',
        podTemplate: {
          ...buildMockWorkspaceKind().podTemplate,
          options: {
            imageConfig: {
              default: 'jupyterlab_scipy_180_hidden',
              values: [
                {
                  id: 'jupyterlab_scipy_180_hidden',
                  displayName: 'jupyter-scipy:v1.8.0 (Hidden)',
                  description: 'JupyterLab v1.8.0',
                  labels: [],
                  hidden: true, // Both hidden and redirected
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

      // Both filters should be checked
      createWorkspace.assertExtraFilterChecked('showHidden');
      createWorkspace.assertExtraFilterChecked('showRedirected');
    });

    it('should check neither filter when default is visible and not redirected', () => {
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
                  redirect: undefined,
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

      // Neither filter should be checked
      createWorkspace.assertExtraFilterNotChecked('showHidden');
      createWorkspace.assertExtraFilterNotChecked('showRedirected');
    });
  });

  describe('Pod config filter defaults', () => {
    it('should check "Show hidden" when default pod config is hidden', () => {
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
              default: 'large_cpu_hidden',
              values: [
                {
                  id: 'tiny_cpu',
                  displayName: 'Tiny CPU',
                  description: 'Small pod',
                  labels: [],
                  hidden: false,
                },
                {
                  id: 'large_cpu_hidden',
                  displayName: 'Large CPU (Hidden)',
                  description: 'Large pod',
                  labels: [],
                  hidden: true,
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

      // "Show hidden" should be checked by default
      createWorkspace.assertExtraFilterChecked('showHidden');
    });

    it('should check "Show redirected" when default pod config is redirected', () => {
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
              default: 'tiny_cpu',
              values: [
                {
                  id: 'tiny_cpu',
                  displayName: 'Tiny CPU',
                  description: 'Small pod',
                  labels: [],
                  hidden: false,
                  redirect: {
                    to: 'small_cpu',
                    message: {
                      text: 'Upgrading to small CPU',
                      level: WorkspacekindsRedirectMessageLevel.RedirectMessageLevelInfo,
                    },
                  },
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

      // "Show redirected" should be checked by default
      createWorkspace.assertExtraFilterChecked('showRedirected');
    });
  });

  describe('Filter interaction and auto-deselect', () => {
    it('should hide hidden options when unchecking "Show hidden"', () => {
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

      // Hidden option should be visible initially
      createWorkspace.assertCardVisible('jupyterlab_scipy_200_hidden');

      // Uncheck "Show hidden"
      createWorkspace.clickExtraFilter('showHidden');

      // Hidden option should now be hidden
      createWorkspace.assertCardNotVisible('jupyterlab_scipy_200_hidden');
    });

    it('should auto-deselect when selected option is filtered out', () => {
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

      // Hidden option should be auto-selected and visible
      createWorkspace.assertImageSelected('jupyterlab_scipy_200_hidden');

      // Uncheck "Show hidden" to filter it out
      createWorkspace.clickExtraFilter('showHidden');

      // The selected option should be deselected
      cy.get('#jupyterlab_scipy_200_hidden').should('not.exist');

      // Next button should be disabled since nothing is selected
      createWorkspace.assertNextButtonDisabled();
    });
  });
});
