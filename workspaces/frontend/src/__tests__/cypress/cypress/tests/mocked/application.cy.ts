import { pageNotfound } from '~/__tests__/cypress/cypress/pages/pageNotFound';
import { home } from '~/__tests__/cypress/cypress/pages/home';
import { mockNamespaces } from '~/__mocks__/mockNamespaces';
import { mockBFFResponse } from '~/__mocks__/utils';
import { mockWorkspace1 } from '~/shared/mock/mockNotebookServiceData';
import { navBar } from '~/__tests__/cypress/cypress/pages/navBar';

describe('Application', () => {
  it('Page not found should render', () => {
    pageNotfound.visit();
  });

  it('Home page should have primary button', () => {
    cy.intercept('GET', '/api/v1/namespaces', {
      body: mockBFFResponse(mockNamespaces),
    }).as('getNamespaces');
    cy.intercept('GET', `/api/v1/workspaces/${mockNamespaces[0].name}`, {
      body: mockBFFResponse([mockWorkspace1]),
    }).as('getWorkspaces');

    home.visit();
    navBar.selectNamespace(mockNamespaces[0].name);

    cy.wait('@getNamespaces');
    cy.wait('@getWorkspaces');

    home.findButton();
  });
});
