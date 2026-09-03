class WorkspaceKindsPage {
  visit(): void {
    cy.visit('/workspacekinds');
  }

  findCreateButton(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('create-workspace-kind-button');
  }

  clickCreate(): void {
    this.findCreateButton().click();
  }

  findTable(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('workspace-kinds-table');
  }

  findTableRows(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findTable().find('tbody tr');
  }

  assertKindExists(name: string): void {
    this.findTable().contains('td', name).should('exist');
  }
}

export const workspaceKindsPage = new WorkspaceKindsPage();
