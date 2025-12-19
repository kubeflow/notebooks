import { WorkspaceForm } from '~/__tests__/cypress/cypress/pages/workspaces/workspaceForm';

class CreateWorkspace extends WorkspaceForm {
  readonly CREATE_WORKSPACE_ROUTE = '/workspaces/create';

  visit(): void {
    cy.visit(this.CREATE_WORKSPACE_ROUTE);
    this.wait();
  }

  verifyPageURL(): Cypress.Chainable<string> {
    return cy.verifyRelativeURL(this.CREATE_WORKSPACE_ROUTE);
  }

  private wait(): void {
    this.findProgressStepper().should('exist');
    cy.testA11y();
  }

  findCreateButton(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findSubmitButton();
  }

  clickCreate(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.clickSubmit();
  }

  assertCreateButtonExists(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.assertSubmitButtonExists();
  }

  assertCreateButtonEnabled(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.assertSubmitButtonEnabled();
  }

  assertCreateButtonDisabled(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.assertSubmitButtonDisabled();
  }

  findErrorAlert() {
    return cy.findByTestId('workspace-form-error');
  }

  assertErrorAlertContainsMessage(message: string) {
    cy.findByTestId('workspace-form-error-message').should('have.text', message);
  }
}

export const createWorkspace = new CreateWorkspace();
