import { pageNotfound } from '~/__tests__/cypress/cypress/pages/pageNotFound';
import { home } from '~/__tests__/cypress/cypress/pages/home';
import { mockNamespaces } from '~/__mocks__/mockNamespaces';
import { mockBFFResponse } from '~/__mocks__/utils';

describe('Application', () => {
  beforeEach(() => {
    // Mock the namespaces API response
    cy.intercept('GET', '/api/v1/namespaces', {
      body: mockBFFResponse(mockNamespaces),
    }).as('getNamespaces');
    cy.visit('/');
    cy.wait('@getNamespaces');
  });

  it('Page not found should render', () => {
    pageNotfound.visit();
  });

  it('Home page should have primary button', () => {
    home.visit();
    home.findButton();
  });
});
