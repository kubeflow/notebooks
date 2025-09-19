import { mockBFFResponse } from '~/__mocks__/utils';
import { mockNamespaces } from '~/__mocks__/mockNamespaces';
import { mockWorkspaces } from '~/__tests__/cypress/cypress/tests/mocked/workspace.mock';
import { navBar } from '~/__tests__/cypress/cypress/pages/navBar';

describe('WorkspaceDetailsActivity Component', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/v1/namespaces', {
      body: mockBFFResponse(mockNamespaces),
    }).as('getNamespaces');
    cy.intercept('GET', '/api/v1/workspaces', {
      body: mockBFFResponse(mockWorkspaces),
    }).as('getWorkspaces');
    cy.intercept('GET', '/api/v1/workspaces/default', {
      body: mockBFFResponse(mockWorkspaces),
    }).as('getDefaultWorkspaces');
    cy.visit('/');
    cy.wait('@getNamespaces');
    // Select a namespace to enable workspace loading
    navBar.selectNamespace('default');
    // Wait for workspaces to load after namespace selection
    cy.wait('@getDefaultWorkspaces');
  });

  // This tests depends on the mocked workspaces data at home page, needs revisit once workspace data fetched from BE
  it('open workspace details, open activity tab, check all fields match', () => {
    cy.findAllByTestId('table-body')
      .first()
      .findByTestId('action-column')
      .find('button')
      .should('be.visible')
      .click();
    cy.findByTestId('action-viewDetails').click();
    cy.findByTestId('activityTab').click();
    cy.findByTestId('lastActivity')
      .invoke('text')
      .then((text) => {
        console.log('Rendered lastActivity:', text);
      });
    cy.findByTestId('pauseTime').should('have.text', 'Jan 1, 2025, 12:00:00 AM');
    cy.findByTestId('lastActivity').should('have.text', 'Jan 2, 2025, 12:00:00 AM');
    cy.findByTestId('lastUpdate').should('have.text', 'Jan 3, 2025, 12:00:00 AM');
    // Use mock data directly since we can't access intercepted response here
    cy.findByTestId('pendingRestart').should('have.text', 'Yes');
  });
});
