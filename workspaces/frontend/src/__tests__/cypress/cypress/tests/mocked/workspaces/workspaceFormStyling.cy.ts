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

describe('Workspace Form Styling', () => {
  let mockNamespace: ReturnType<typeof buildMockNamespace>;
  let mockWorkspaceKind: ReturnType<typeof buildMockWorkspaceKind>;

  beforeEach(() => {
    mockNamespace = buildMockNamespace({ name: DEFAULT_NAMESPACE });

    const normalImage = buildMockImageConfigValue({
      id: 'normal-image',
      displayName: 'Normal Image',
      description: 'A normal image without special flags',
      hidden: false,
    });

    const hiddenImage = buildMockImageConfigValue({
      id: 'hidden-image',
      displayName: 'Hidden Image',
      description: 'This image is hidden',
      hidden: true,
    });

    const redirectImage = buildMockImageConfigValue({
      id: 'redirect-image',
      displayName: 'Redirected Image',
      description: 'This image has a redirect',
      redirect: {
        to: 'normal-image',
        message: {
          level: WorkspacekindsRedirectMessageLevel.RedirectMessageLevelInfo,
          text: 'Redirecting to normal image',
        },
      },
    });

    mockWorkspaceKind = buildMockWorkspaceKind({
      name: 'test-kind',
      displayName: 'Test Workspace Kind',
      podTemplate: {
        ...buildMockWorkspaceKind().podTemplate,
        options: {
          ...buildMockWorkspaceKind().podTemplate.options,
          imageConfig: {
            default: 'normal-image',
            values: [normalImage, hiddenImage, redirectImage],
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
  });

  describe('Workspace Kind logo styling', () => {
    it('should apply workspace-kind-logo class to kind logos', () => {
      cy.visit('/workspaces/create');
      cy.wait('@getNamespaces');
      navBar.selectNamespace(mockNamespace.name);
      cy.wait('@getWorkspaceKinds');

      createWorkspace
        .findKindLogo('test-kind')
        .should('exist')
        .should('have.class', 'workspace-kind-logo');
    });

    it('should constrain logo width with CSS class', () => {
      cy.visit('/workspaces/create');
      cy.wait('@getNamespaces');
      navBar.selectNamespace(mockNamespace.name);
      cy.wait('@getWorkspaceKinds');

      createWorkspace.findKindLogo('test-kind').should('have.css', 'max-width', '60px');
    });
  });

  describe('Option card header styling', () => {
    beforeEach(() => {
      cy.visit('/workspaces/create');
      cy.wait('@getNamespaces');
      navBar.selectNamespace(mockNamespace.name);
      cy.wait('@getWorkspaceKinds');
      createWorkspace.selectKind('test-kind');
      createWorkspace.clickNext(); // Go to image selection
    });

    it('should apply workspace-option-card__header--with-icons class to cards with hidden flag', () => {
      createWorkspace.checkExtraFilter('showHidden');

      createWorkspace
        .findOptionCardHeader('hidden-image')
        .should('have.class', 'workspace-option-card__header--with-icons');
    });

    it('should apply workspace-option-card__header--with-icons class to cards with redirect', () => {
      createWorkspace.checkExtraFilter('showRedirected');

      createWorkspace
        .findOptionCardHeader('redirect-image')
        .should('have.class', 'workspace-option-card__header--with-icons');
    });

    it('should NOT apply workspace-option-card__header--with-icons class to normal cards', () => {
      createWorkspace
        .findOptionCardHeader('normal-image')
        .should('not.have.class', 'workspace-option-card__header--with-icons');
    });

    it('should apply workspace-option-card__description class to card descriptions', () => {
      createWorkspace
        .findOptionCardDescription('normal-image')
        .should('exist')
        .should('have.class', 'workspace-option-card__description')
        .should('have.css', 'color');
    });

    it('should position icons container absolutely on cards with icons', () => {
      createWorkspace.checkExtraFilter('showHidden');

      createWorkspace
        .findOptionCardIcons('hidden-image')
        .should('exist')
        .should('have.css', 'position', 'absolute');
    });
  });

  describe('Summary redirect icon styling', () => {
    beforeEach(() => {
      cy.visit('/workspaces/create');
      cy.wait('@getNamespaces');
      navBar.selectNamespace(mockNamespace.name);
      cy.wait('@getWorkspaceKinds');
      createWorkspace.selectKind('test-kind');
      createWorkspace.clickNext(); // Image

      createWorkspace.checkExtraFilter('showRedirected');
      createWorkspace.selectImage('redirect-image');

      createWorkspace.clickNext(); // Pod config
      createWorkspace.clickNext(); // Properties - now at summary
    });

    it('should apply summary-redirect-icon-button class to redirect icon', () => {
      createWorkspace
        .findRedirectSummaryIcon(1, 'current')
        .should('exist')
        .should('have.class', 'summary-redirect-icon-button');
    });

    it('should style redirect icon button with correct cursor and display', () => {
      createWorkspace
        .findRedirectSummaryIcon(1, 'current')
        .should('have.css', 'cursor', 'pointer')
        .should('have.css', 'display', 'inline-flex');
    });
  });

  describe('Full height layout styling', () => {
    it('should apply workspace-form__full-height class to form sections', () => {
      cy.visit('/workspaces/create');
      cy.wait('@getNamespaces');
      navBar.selectNamespace(mockNamespace.name);
      cy.wait('@getWorkspaceKinds');
      createWorkspace.selectKind('test-kind');
      createWorkspace.clickNext();

      cy.get('.workspace-form__full-height').should('exist');
    });

    it('should apply workspace-form__filter-sidebar class to filter sidebars', () => {
      cy.visit('/workspaces/create');
      cy.wait('@getNamespaces');
      navBar.selectNamespace(mockNamespace.name);
      cy.wait('@getWorkspaceKinds');
      createWorkspace.selectKind('test-kind');
      createWorkspace.clickNext(); // Image selection

      createWorkspace.findFilterSidebar().should('exist').should('have.css', 'min-width', '200px');
    });
  });

  describe('CSS class verification', () => {
    it('should apply CSS classes to rendered elements', () => {
      cy.visit('/workspaces/create');
      cy.wait('@getNamespaces');
      navBar.selectNamespace(mockNamespace.name);
      cy.wait('@getWorkspaceKinds');

      createWorkspace
        .findKindLogo('test-kind')
        .should('exist')
        .should('have.css', 'max-width', '60px');

      createWorkspace.selectKind('test-kind');
      createWorkspace.clickNext();

      cy.get('.workspace-form__full-height').should('exist');

      createWorkspace.findFilterSidebar().should('exist').should('have.css', 'min-width', '200px');

      createWorkspace.checkExtraFilter('showHidden');

      createWorkspace.findOptionCardDescription('hidden-image').should('exist');

      createWorkspace
        .findOptionCardHeader('hidden-image')
        .should('have.class', 'workspace-option-card__header--with-icons');

      createWorkspace.findOptionCardIcons('hidden-image').should('exist');
    });
  });
});
