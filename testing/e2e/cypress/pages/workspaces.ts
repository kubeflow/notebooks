class WorkspacesPage {
  visit(): void {
    cy.visit('/');
  }

  selectNamespace(namespace: string): void {
    cy.get('.kubeflow-u-namespace-select').within(() => {
      cy.get('button').first().click();
    });
    cy.get('.pf-v6-c-menu__list-item').contains(namespace).click();
  }

  findCreateButton(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.contains('button', 'Create workspace');
  }

  clickCreate(): void {
    this.findCreateButton().click();
  }

  findTable(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('workspaces-table');
  }

  assertWorkspaceExists(name: string): void {
    this.findTable().contains('td', name).should('exist');
  }
}

export const workspacesPage = new WorkspacesPage();
