import { WorkspaceForm } from '~/__tests__/cypress/cypress/pages/workspaces/workspaceForm';

class EditWorkspace extends WorkspaceForm {
  readonly EDIT_WORKSPACE_ROUTE = '/workspaces/edit';

  visitWithState(state: {
    namespace: string;
    workspaceName: string;
    workspaceKindName: string;
  }): void {
    cy.visit(this.EDIT_WORKSPACE_ROUTE, {
      onBeforeLoad: (win) => win.history.pushState({ usr: state }, '', this.EDIT_WORKSPACE_ROUTE),
    });
  }

  verifyPageURL(): Cypress.Chainable<string> {
    return cy.verifyRelativeURL(this.EDIT_WORKSPACE_ROUTE);
  }

  assertSubmissionError(message: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy
      .findByTestId('workspace-form-error')
      .should('be.visible')
      .and('contain.text', message);
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

  findResourceNameCannotBeChangedHelper(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('workspace-resource-name-cannot-be-changed-helper');
  }

  assertResourceNameCannotBeChangedHelperTextVisible(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findResourceNameCannotBeChangedHelper().should('be.visible');
  }

  scrollSecretsIntoView(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.findByTestId('secrets-count').scrollIntoView();
  }

  assertDataVolumesSectionExpanded(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findDataVolumesExpandableToggle().should('have.attr', 'aria-expanded', 'true');
  }

  assertSecretsSectionExpanded(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findSecretsExpandableToggle().should('have.attr', 'aria-expanded', 'true');
  }

  /** In update mode the resource name is always shown as plain read-only text, never an editable input. */
  assertResourceNameNotEditable(): void {
    this.findResourceNameText().should('exist');
    this.findResourceNameEditButton().should('not.exist');
    this.findResourceNameInput().should('not.exist');
  }

  assertDisplayNameInputEnabled(): Cypress.Chainable<JQuery<HTMLElement>> {
    return this.findDisplayNameInput().should('not.be.disabled');
  }
}

export const editWorkspace = new EditWorkspace();
