import { mockModArchResponse } from 'mod-arch-core';
import { createWorkspace } from '~/__tests__/cypress/cypress/pages/workspaces/createWorkspace';
import { buildMockNamespace, buildMockWorkspaceKind } from '~/shared/mock/mockBuilder';
import { NOTEBOOKS_API_VERSION } from '~/__tests__/cypress/cypress/support/commands/api';
import { navBar } from '~/__tests__/cypress/cypress/pages/components/navBar';
import type { WorkspacekindsImageConfigValue } from '~/generated/data-contracts';
import { WorkspacekindsRedirectMessageLevel } from '~/generated/data-contracts';

const buildMockImageConfigValue = (
  overrides?: Partial<WorkspacekindsImageConfigValue>,
): WorkspacekindsImageConfigValue => ({
  id: 'default-image',
  displayName: 'Default Image',
  description: 'Default description',
  labels: [],
  hidden: false,
  ...overrides,
});

const DEFAULT_NAMESPACE = 'default';

describe('Summary Redirect Popover - Delayed Hide Behavior', () => {
  let mockNamespace: ReturnType<typeof buildMockNamespace>;
  let mockWorkspaceKind: ReturnType<typeof buildMockWorkspaceKind>;

  beforeEach(() => {
    mockNamespace = buildMockNamespace({ name: DEFAULT_NAMESPACE });

    const sourceImage = buildMockImageConfigValue({
      id: 'source-image',
      displayName: 'Source Image v1.0',
      description: 'Old version image',
      redirect: {
        to: 'target-image',
        message: {
          level: WorkspacekindsRedirectMessageLevel.RedirectMessageLevelWarning,
          text: 'This image is deprecated. Please use the target image.',
        },
      },
    });

    const targetImage = buildMockImageConfigValue({
      id: 'target-image',
      displayName: 'Target Image v2.0',
      description: 'New version image',
    });

    mockWorkspaceKind = buildMockWorkspaceKind({
      name: 'test-kind',
      displayName: 'Test Workspace Kind',
      podTemplate: {
        ...buildMockWorkspaceKind().podTemplate,
        options: {
          ...buildMockWorkspaceKind().podTemplate.options,
          imageConfig: {
            default: 'source-image',
            values: [sourceImage, targetImage],
          },
        },
      },
    });

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

    cy.visit('/workspaces/create');
    cy.wait('@getNamespaces');
    navBar.selectNamespace(mockNamespace.name);
    cy.wait('@getWorkspaceKinds');

    createWorkspace.selectKind('test-kind');
    createWorkspace.clickNext();

    // Need to check the showRedirected filter to see images with redirect
    createWorkspace.checkExtraFilter('showRedirected');

    createWorkspace.selectImage('source-image');
    createWorkspace.assertImageSelected('source-image');
  });

  describe('Pinning behavior', () => {
    it('should pin popover on icon click', () => {
      createWorkspace.clickNext(); // Pod config
      createWorkspace.clickNext(); // Properties

      cy.findByTestId('redirect-icon-1-current').click();
      cy.get('.pf-v6-c-popover').should('be.visible');

      cy.findByTestId('redirect-icon-1-current').trigger('mouseleave');
      cy.get('.pf-v6-c-popover', { timeout: 2000 }).should('be.visible');
    });

    it('should unpin popover on second click', () => {
      createWorkspace.clickNext(); // Pod config
      createWorkspace.clickNext(); // Properties

      cy.findByTestId('redirect-icon-1-current').click();
      cy.get('.pf-v6-c-popover').should('be.visible');

      cy.findByTestId('redirect-icon-1-current').click();
      cy.get('.pf-v6-c-popover').should('not.be.visible');
    });

    it('should not start delayed hide timer when popover is pinned', () => {
      createWorkspace.clickNext(); // Pod config
      createWorkspace.clickNext(); // Properties

      cy.findByTestId('redirect-icon-1-current').click();
      cy.get('.pf-v6-c-popover').should('be.visible');

      cy.findByTestId('redirect-icon-1-current').trigger('mouseenter');
      cy.findByTestId('redirect-icon-1-current').trigger('mouseleave');

      cy.get('.pf-v6-c-popover', { timeout: 2000 }).should('be.visible');
    });
  });

  describe('Keyboard accessibility', () => {
    it('should pin popover on Enter key', () => {
      createWorkspace.clickNext(); // Pod config
      createWorkspace.clickNext(); // Properties

      cy.findByTestId('redirect-icon-1-current').focus();
      cy.findByTestId('redirect-icon-1-current').type('{enter}');
      cy.get('.pf-v6-c-popover').should('be.visible');
    });

    it('should pin popover on Space key', () => {
      createWorkspace.clickNext(); // Pod config
      createWorkspace.clickNext(); // Properties

      cy.findByTestId('redirect-icon-1-current').focus();
      cy.findByTestId('redirect-icon-1-current').type(' ');
      cy.get('.pf-v6-c-popover').should('be.visible');
    });
  });
});
