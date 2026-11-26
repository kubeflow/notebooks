import { environment } from '../support/browser/environment';

/** The Workspaces list (`/workspaces`). */
class WorkspacesPage {
  /** Opens the list for `namespace` (default: the suite's namespace). */
  visit({ namespace = environment.namespace }: { namespace?: string } = {}): void {
    cy.visit('/workspaces');
    this.selectNamespace(namespace);
  }

  findNamespaceSelect(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('namespace-select-toggle');
  }

  selectNamespace(namespace: string): void {
    this.findNamespaceSelect().click();
    cy.findByRole('option', { name: namespace }).click();
    this.findNamespaceSelect().should('contain.text', namespace);
  }

  findCreateButton(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('create-workspace-button');
  }

  clickCreate(): void {
    this.findCreateButton().click();
  }

  findTable(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('workspaces-table');
  }

  /** The row whose name column shows `name` (rows are keyed by index, not name). */
  findRow(name: string): Cypress.Chainable<JQuery<HTMLElement>> {
    // Filters rows (not names + closest()) so a missing row yields an empty set and
    // `findRow(name).should('not.exist')` works.
    return this.findTable()
      .find('[data-testid^="workspace-row-"]')
      .filter(
        (_index, row) =>
          Cypress.$(row).find('[data-testid="workspace-name-link"]').text().trim() === name,
      );
  }
}

export const workspacesPage = new WorkspacesPage();
