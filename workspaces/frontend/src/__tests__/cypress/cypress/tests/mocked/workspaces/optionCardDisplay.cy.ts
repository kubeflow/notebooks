import { mockModArchResponse } from 'mod-arch-core';
import { createWorkspace } from '~/__tests__/cypress/cypress/pages/workspaces/createWorkspace';
import { NOTEBOOKS_API_VERSION } from '~/__tests__/cypress/cypress/support/commands/api';
import { buildMockNamespace, buildMockWorkspaceKind } from '~/shared/mock/mockBuilder';
import { WorkspacekindsRedirectMessageLevel } from '~/generated/data-contracts';

type ImageConfigOption = {
  id: string;
  displayName: string;
  description: string;
  labels?: { key: string; value: string }[];
  hidden?: boolean;
  redirect?: {
    to: string;
    message?: {
      text: string;
      level: WorkspacekindsRedirectMessageLevel;
    };
  };
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
            redirect: img.redirect,
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
      const mockWorkspaceKind = buildWorkspaceKindWithOptions({
        defaultImageId: 'jupyterlab_scipy_190',
        imageOptions: [
          {
            id: 'jupyterlab_scipy_190',
            displayName: 'jupyter-scipy:v1.9.0',
            description: 'JupyterLab v1.9.0',
          },
          {
            id: 'jupyterlab_scipy_200_hidden',
            displayName: 'jupyter-scipy:v2.0.0 (Hidden)',
            description: 'JupyterLab v2.0.0',
            hidden: true,
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

      // Enable "Show hidden" to see the hidden option
      createWorkspace.checkExtraFilter('showHidden');

      createWorkspace.assertCardHasHiddenIndicator('jupyterlab_scipy_200_hidden');
      createWorkspace.assertCardDoesNotHaveHiddenIndicator('jupyterlab_scipy_190');
    });
  });

  describe('Visual indicators for redirected options', () => {
    it('should show brown left border and redirect icon for redirected option', () => {
      const mockWorkspaceKind = buildWorkspaceKindWithOptions({
        defaultImageId: 'jupyterlab_scipy_190',
        imageOptions: [
          {
            id: 'jupyterlab_scipy_180',
            displayName: 'jupyter-scipy:v1.8.0',
            description: 'JupyterLab v1.8.0',
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

      // Enable "Show redirected" to see the redirected option
      createWorkspace.checkExtraFilter('showRedirected');

      createWorkspace.assertCardHasRedirectIndicator('jupyterlab_scipy_180');
      createWorkspace.assertCardDoesNotHaveRedirectIndicator('jupyterlab_scipy_190');
    });
  });

  describe('Visual indicators for hidden AND redirected options', () => {
    it('should show grey border (hidden takes precedence) with both icons', () => {
      const mockWorkspaceKind = buildWorkspaceKindWithOptions({
        defaultImageId: 'jupyterlab_scipy_190',
        imageOptions: [
          {
            id: 'jupyterlab_scipy_180_hidden',
            displayName: 'jupyter-scipy:v1.8.0 (Hidden)',
            description: 'JupyterLab v1.8.0',
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

      // Enable both filters to see the option
      createWorkspace.checkExtraFilter('showHidden');
      createWorkspace.checkExtraFilter('showRedirected');

      createWorkspace.assertCardHasBothIndicators('jupyterlab_scipy_180_hidden');
    });
  });

  describe('Default badge display', () => {
    it('should show "Default" badge on default option', () => {
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
      const mockWorkspaceKind = buildWorkspaceKindWithOptions({
        defaultImageId: 'jupyterlab_scipy_190',
        imageOptions: [
          {
            id: 'jupyterlab_scipy_190',
            displayName: 'jupyter-scipy:v1.9.0',
            description: 'JupyterLab v1.9.0',
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
      const mockWorkspaceKind = buildWorkspaceKindWithOptions({
        defaultImageId: 'jupyterlab_scipy_200_hidden',
        imageOptions: [
          {
            id: 'jupyterlab_scipy_190',
            displayName: 'jupyter-scipy:v1.9.0',
            description: 'JupyterLab v1.9.0',
          },
          {
            id: 'jupyterlab_scipy_200_hidden',
            displayName: 'jupyter-scipy:v2.0.0 (Hidden)',
            description: 'JupyterLab v2.0.0',
            hidden: true,
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

      createWorkspace.assertCardIsSelected('jupyterlab_scipy_200_hidden');
      createWorkspace.assertCardHasHiddenIndicator('jupyterlab_scipy_200_hidden');
      createWorkspace.assertCardHasDefaultBadge('jupyterlab_scipy_200_hidden');
    });
  });
});
