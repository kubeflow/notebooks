import { home } from '~/__tests__/cypress/cypress/pages/home';

describe('WorkspaceDetailsActivity Component', () => {
  beforeEach(() => {
    home.visit();
  });

  // This tests depends on the mocked workspaces data at home page, needs revisit once workspace data fetched from BE
  it('open workspace details, open activity tab, check all fields match', () => {
    cy.findAllByTestId('table-body').first().findByTestId('action-column').click();
    cy.findByTestId('action-view-details').click();
    cy.findByTestId('activityTab').click();
    cy.findByTestId('lastActivity').should('have.text', '2/16/2025, 4:40:00 AM');
    cy.findByTestId('lastUpdate').should('have.text', '2/16/2025, 4:41:40 AM');
    cy.findByTestId('pauseTime').should('have.text', '2/16/2025, 4:38:20 AM');
    cy.findByTestId('pendingRestart').should('have.text', 'No');
  });
});
