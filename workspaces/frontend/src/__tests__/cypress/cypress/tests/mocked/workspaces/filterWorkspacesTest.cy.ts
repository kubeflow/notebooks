import { mockNamespaces } from '~/__mocks__/mockNamespaces';
import { mockWorkspaces } from '~/__mocks__/mockWorkspaces';
import { mockBFFResponse } from '~/__mocks__/utils';
import { home } from '~/__tests__/cypress/cypress/pages/home';

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
    });
    cy.intercept('GET', '/api/v1/workspaces', {
      body: mockBFFResponse(mockWorkspaces),
    }).as('getWorkspaces');
    cy.intercept('GET', '/api/v1/workspaces/default', {
      body: mockBFFResponse(mockWorkspaces),
    });
    cy.intercept('GET', '/api/namespaces/test-namespace/workspaces').as('getWorkspaces');
  });

  it('filter rows with single filter', () => {
    home.visit();

    // Wait for the API call before trying to interact with the UI
    cy.wait('@getWorkspaces');

    useFilter('name', 'Name', 'My');
    cy.get("[id$='workspaces-table-content']").find('tr').should('have.length', 2);
    cy.get("[id$='workspaces-table-row-1']").contains('My First Jupyter Notebook');
    cy.get("[id$='workspaces-table-row-2']").contains('My Second Jupyter Notebook');
  });

  it('filter rows with multiple filters', () => {
    home.visit();
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
    home.visit();
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
    home.visit();
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
