import { mockBFFResponse } from '~/__mocks__/utils';
import { mockWorkspaces } from '~/__tests__/cypress/cypress/tests/mocked/workspace.mock';

describe('WorkspaceDetailsActivity Component', () => {
  beforeEach(() => {
    cy.intercept('GET', 'api/v1/workspaces', {
      body: mockBFFResponse(mockWorkspaces),
    }).as('getWorkspaces');
    cy.visit('/');
  });

  // This tests depends on the mocked workspaces data at home page, needs revisit once workspace data fetched from BE
  it('open workspace details, open activity tab, check all fields match', () => {
    cy.findAllByTestId('table-body')
      .first()
      .findByTestId('action-column')
      .find('button')
      .should('be.visible')
      .click();
    // Extract first workspace from mock data
    cy.wait('@getWorkspaces').then((interception) => {
      if (!interception.response || !interception.response.body) {
        throw new Error('Intercepted response is undefined or empty');
      }
      const workspace = interception.response.body.data[0];
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
      cy.findByTestId('pendingRestart').should(
        'have.text',
        workspace.pendingRestart ? 'Yes' : 'No',
      );
    });
  });
});
