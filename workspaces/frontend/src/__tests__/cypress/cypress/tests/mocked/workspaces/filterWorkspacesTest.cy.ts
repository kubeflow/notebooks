import { mockNamespaces } from '~/__mocks__/mockNamespaces';
import { mockWorkspaces } from '~/__mocks__/mockWorkspaces';
import { mockBFFResponse } from '~/__mocks__/utils';
import { home } from '~/__tests__/cypress/cypress/pages/home';
import { navBar } from '~/__tests__/cypress/cypress/pages/navBar';
import { mockWorkspaceKinds } from '~/shared/mock/mockNotebookServiceData';

const useFilter = (filterKey: string, filterName: string, searchValue: string) => {
  cy.get("[id$='filter-workspaces-dropdown']").click();
  cy.get(`[id$='filter-workspaces-dropdown-${filterKey}']`).click();
  cy.get("[data-testid='filter-workspaces-search-input']").type(searchValue);
  cy.get("[class$='pf-v6-c-toolbar__group']").contains(filterName);
  cy.get("[class$='pf-v6-c-toolbar__group']").contains(searchValue);
};

describe('Application', () => {
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
    cy.intercept('GET', '/api/v1/workspaces/custom-namespace', {
      body: mockBFFResponse(mockWorkspaces),
    });
    cy.intercept('GET', '/api/v1/workspacekinds', {
      body: mockBFFResponse(mockWorkspaceKinds),
    });
    home.visit();
    cy.wait('@getNamespaces');
    // Select a namespace to enable workspace loading
    navBar.selectNamespace('default');
    // Wait for workspaces to load after namespace selection
    cy.wait('@getDefaultWorkspaces');
  });

  it('filter rows with single filter', () => {
    useFilter('name', 'Name', 'My');
    cy.get("[id$='workspaces-table-content']").find('tr').should('have.length', 2);
    cy.get("[id$='workspaces-table-row-1']").contains('My First Jupyter Notebook');
    cy.get("[id$='workspaces-table-row-2']").contains('My Second Jupyter Notebook');
  });

  it('filter rows with multiple filters', () => {
    // First filter by name
    useFilter('name', 'Name', 'My');
    cy.get("[id$='workspaces-table-content']").find('tr').should('have.length', 2);
    cy.get("[id$='workspaces-table-row-1']").contains('My First Jupyter Notebook');

    // Add second filter by image
    useFilter('image', 'Image', 'jupyter');
    cy.get("[class$='pf-v6-c-toolbar__group']").contains('Name');
    cy.get("[class$='pf-v6-c-toolbar__group']").contains('Image');
    cy.get("[id$='workspaces-table-content']").find('tr').should('have.length', 2);
    cy.get("[id$='workspaces-table-row-1']").contains('My First Jupyter Notebook');
  });

  it('filter rows with multiple filters and remove one', () => {
    // Add name filter
    useFilter('name', 'Name', 'My');
    cy.get("[id$='workspaces-table-content']").find('tr').should('have.length', 2);
    cy.get("[id$='workspaces-table-row-1']").contains('My First Jupyter Notebook');

    // Add image filter
    useFilter('image', 'Image', 'jupyter');
    cy.get("[class$='pf-v6-c-toolbar__group']").contains('Name');
    cy.get("[class$='pf-v6-c-toolbar__group']").contains('Image');
    cy.get("[id$='workspaces-table-content']").find('tr').should('have.length', 2);

    // Remove one filter (the first one)
    cy.get("[class$='pf-v6-c-label-group__close']").first().click();
    cy.get("[class$='pf-v6-c-toolbar__group']").should('not.contain', 'Name');
    cy.get("[class$='pf-v6-c-toolbar__group']").contains('Image');
    cy.get("[id$='workspaces-table-content']").find('tr').should('have.length', 2);
    cy.get("[id$='workspaces-table-row-1']").contains('My First Jupyter Notebook');
    cy.get("[id$='workspaces-table-row-2']").contains('My Second Jupyter Notebook');
  });

  it('filter rows with multiple filters and remove all', () => {
    // Add name filter
    useFilter('name', 'Name', 'My');
    cy.get("[id$='workspaces-table-content']").find('tr').should('have.length', 2);
    cy.get("[id$='workspaces-table-row-1']").contains('My First Jupyter Notebook');

    // Add image filter
    useFilter('image', 'Image', 'jupyter');
    cy.get("[class$='pf-v6-c-toolbar__group']").contains('Name');
    cy.get("[class$='pf-v6-c-toolbar__group']").contains('Image');

    // Clear all filters
    cy.get('*').contains('Clear all filters').click();
    cy.get("[class$='pf-v6-c-toolbar__group']").should('not.contain', 'Name');
    cy.get("[class$='pf-v6-c-toolbar__group']").should('not.contain', 'Image');
    cy.get("[id$='workspaces-table-content']").find('tr').should('have.length', 2);
  });
});
