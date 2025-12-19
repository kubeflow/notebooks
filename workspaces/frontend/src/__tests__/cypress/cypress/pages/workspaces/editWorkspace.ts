import { WorkspaceForm } from '~/__tests__/cypress/cypress/pages/workspaces/workspaceForm';

class EditWorkspace extends WorkspaceForm {
  readonly EDIT_WORKSPACE_ROUTE = '/workspaces/edit';

  verifyPageURL(): Cypress.Chainable<string> {
    return cy.verifyRelativeURL(this.EDIT_WORKSPACE_ROUTE);
  }

  findSaveButton(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findSubmitButton();
  }

  clickSave(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.clickSubmit();
  }

  assertSaveButtonExists(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.assertSubmitButtonExists();
  }

  assertSaveButtonText(text: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.assertSubmitButtonText(text);
  }

  assertSaveButtonEnabled(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.assertSubmitButtonEnabled();
  }

  assertSaveButtonDisabled(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.assertSubmitButtonDisabled();
  }

  // Edit-specific methods
  findWorkspaceKindCannotBeChangedAlert(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('workspace-kind-cannot-be-changed-alert');
  }

  assertWorkspaceKindCannotBeChangedAlertVisible(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findWorkspaceKindCannotBeChangedAlert().should('be.visible');
  }

  findWorkspaceNameCannotBeChangedHelper(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('workspace-name-cannot-be-changed-helper');
  }

  assertWorkspaceNameCannotBeChangedHelperTextVisible(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findWorkspaceNameCannotBeChangedHelper().should('be.visible');
  }

  assertWorkspaceNameInputDisabled(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findWorkspaceNameInput().should('be.disabled');
  }
}

export const editWorkspace = new EditWorkspace();
