import { mockModArchResponse } from 'mod-arch-core';
import { pageNotfound } from '~/__tests__/cypress/cypress/pages/pageNotFound';
import { home } from '~/__tests__/cypress/cypress/pages/home';
import { NOTEBOOKS_API_VERSION } from '~/__tests__/cypress/cypress/support/commands/api';
import { workspaces } from '~/__tests__/cypress/cypress/pages/workspaces/workspaces';
import { buildMockNamespace, buildMockWorkspace } from '~/shared/mock/mockBuilder';
import { navBar } from '~/__tests__/cypress/cypress/pages/components/navBar';

describe('Application', () => {
  it('should redirect to page not found when visiting a non-existent page', () => {
    pageNotfound.visit();
    pageNotfound.assertPageVisible();
  });

  describe('NavBar', () => {
    it('should use the username as the accessible name for the user menu toggle', () => {
      // Regression for label-content-name-mismatch: the MenuToggle renders the visible
      // username as its text child. Any aria-label that shadows that text would cause this
      // query to fail, re-surfacing the axe violation.
      // AppContext.tsx hardcodes userId: 'kubeflow-user' until user API integration lands.
      pageNotfound.visit();
      cy.findByRole('button', { name: 'kubeflow-user' })
        .should('be.visible')
        .should('have.attr', 'id', 'user-menu-toggle')
        .should('contain.text', 'kubeflow-user');
    });

    it('should open the user menu when the toggle is clicked', () => {
      pageNotfound.visit();
      navBar.openUserMenu();
      cy.findByRole('menuitem', { name: 'Log out' }).should('be.visible');
    });
  });

  it('should redirect to Workspaces page when visiting the root', () => {
    const mockNamespace = buildMockNamespace({ name: 'default' });
    const mockWorkspace = buildMockWorkspace({ namespace: mockNamespace.name });

    cy.interceptApi(
      'GET /api/:apiVersion/namespaces',
      { path: { apiVersion: NOTEBOOKS_API_VERSION } },
      mockModArchResponse([mockNamespace]),
    ).as('getNamespaces');

    cy.interceptApi(
      'GET /api/:apiVersion/workspaces/:namespace',
      { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockNamespace.name } },
      mockModArchResponse([mockWorkspace]),
    ).as('getWorkspaces');

    home.visit();

    cy.wait('@getNamespaces');
    cy.wait('@getWorkspaces');

    workspaces.findPageTitle();
    workspaces.verifyPageURL();
  });
});
