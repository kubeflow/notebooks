/** The WorkspaceKinds list (`/workspacekinds`). Cluster-scoped, so no namespace. */
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

  /** The row for WorkspaceKind `name` (its `metadata.name`; rows are keyed by index, not name). */
  findRow(name: string): Cypress.Chainable<JQuery<HTMLElement>> {
    // Filters rows (not names + closest()) so a missing row yields an empty set and
    // `findRow(name).should('not.exist')` works.
    return this.findTable()
      .find('[data-testid^="workspace-kind-row-"]')
      .filter(
        (_index, row) =>
          Cypress.$(row).find('[data-testid="workspace-kind-name"]').text().trim() === name,
      );
  }

  findDeleteModal(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('delete-modal');
  }

  /** Deletes through the row's kebab menu and the type-the-name confirmation modal. */
  deleteWorkspaceKind(name: string): void {
    this.findRow(name)
      .findByRole('button', { name: /kebab toggle/i })
      .click();
    cy.findByTestId('action-delete-workspace-kind').click();
    this.findDeleteModal().within(() => {
      cy.findByTestId('delete-modal-input').type(name);
      cy.findByTestId('delete-button').should('be.enabled').click();
    });
    this.findDeleteModal().should('not.exist');
  }
}

export const workspaceKindsPage = new WorkspaceKindsPage();
