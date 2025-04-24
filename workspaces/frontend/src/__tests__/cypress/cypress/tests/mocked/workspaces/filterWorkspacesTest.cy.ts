import { home } from '~/__tests__/cypress/cypress/pages/home';

const useFilter = (filterName: string, searchValue: string) => {
  cy.get("[id$='filter-workspaces-dropdown']").click();
  cy.get(`[id$='filter-workspaces-dropdown-${filterName}']`).click();
  cy.get("[id$='filter-workspaces-search-input']").type(searchValue);
  cy.get("[class$='pf-v6-c-toolbar__group']").contains(filterName);
  cy.get("[class$='pf-v6-c-toolbar__group']").contains(searchValue);
};

describe('Application', () => {
  it('filter rows with single filter', () => {
    home.visit();
    useFilter('Name', 'My');
    cy.get("[id$='workspaces-table-content']").find('tr').should('have.length', 2);
    cy.get("[id$='workspaces-table-row-1']").contains('My Jupyter Notebook');
    cy.get("[id$='workspaces-table-row-2']").contains('My Other Jupyter Notebook');
  });

  it('filter rows with multiple filters', () => {
    home.visit();
    useFilter('Name', 'My');
    useFilter('Pod Config', 'Small');
    cy.get("[id$='workspaces-table-content']").find('tr').should('have.length', 1);
    cy.get("[id$='workspaces-table-row-1']").contains('My Jupyter Notebook');
  });

  it('filter rows with multiple filters and remove one', () => {
    home.visit();
    useFilter('Name', 'My');
    useFilter('Pod Config', 'Small');
    cy.get("[id$='workspaces-table-content']").find('tr').should('have.length', 1);
    cy.get("[id$='workspaces-table-row-1']").contains('My Jupyter Notebook');
    cy.get("[class$='pf-v6-c-label-group__close']").eq(1).click();
    cy.get("[class$='pf-v6-c-toolbar__group']").should('not.contain', 'Pod Config');
    cy.get("[id$='workspaces-table-content']").find('tr').should('have.length', 2);
    cy.get("[id$='workspaces-table-row-1']").contains('My Jupyter Notebook');
    cy.get("[id$='workspaces-table-row-2']").contains('My Other Jupyter Notebook');
  });

  it('filter rows with multiple filters and remove all', () => {
    home.visit();
    useFilter('Name', 'My');
    useFilter('Pod Config', 'Small');
    cy.get("[id$='workspaces-table-content']").find('tr').should('have.length', 1);
    cy.get("[id$='workspaces-table-row-1']").contains('My Jupyter Notebook');
    cy.get('*').contains('Clear all filters').click();
    cy.get("[class$='pf-v6-c-toolbar__group']").should('not.contain', 'Pod Config');
    cy.get("[class$='pf-v6-c-toolbar__group']").should('not.contain', 'Name');
    cy.get("[id$='workspaces-table-content']").find('tr').should('have.length', 2);
  });
});
